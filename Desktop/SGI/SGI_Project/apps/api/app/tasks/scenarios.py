"""Tâches Celery — module Scenarios (génération vidéo social media).

Queue : exports (traitement lourd non temps-réel).

`generate` produit une **vraie vidéo** via **FFmpeg** : un diaporama vertical
9:16 des photos uploadées + une **voix** — soit la voix d'avatar **synthétisée**
(Azure TTS depuis le script, voix par genre × langue), soit la voix enregistrée
au micro. La durée du diaporama est calée sur celle de la voix. Encodé H.264 et
uploadé sur MinIO. Statut `generating` → `ready` (URL signée) ou `failed`. Sans
clé Azure ni audio enregistré, le diaporama est silencieux (repli gracieux).

Rôle privilégié (`sync_session_maker`) comme les autres tâches, mais on pose le
GUC tenant et on filtre explicitement par `company_id` (Loi 1).
"""

import logging
import os
import subprocess
import tempfile
import uuid
from datetime import UTC, datetime
from typing import Any

from celery import shared_task
from sqlalchemy import select, text

from app.core import storage
from app.core.database import sync_session_maker
from app.routers.scenarios import tts
from app.routers.scenarios.models import VideoScenario
from app.routers.scenarios.service import (
    SECONDS_PER_PHOTO,
    VIDEO_URL_TTL,
    build_ffmpeg_command,
    ffmpeg_output_key,
    owns_ref,
)

logger = logging.getLogger(__name__)

_FFMPEG_TIMEOUT_S = 180


def _probe_duration(path: str) -> float:
    """Durée (secondes) d'un média via ffprobe. 0 si indisponible."""
    args = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nw=1:nk=1",
        path,
    ]
    try:
        out = subprocess.run(args, capture_output=True, timeout=30)  # noqa: S603
        return float(out.stdout.decode().strip() or 0)
    except Exception:  # noqa: BLE001
        return 0.0


def _prepare_audio(scenario: VideoScenario, tmp: str) -> str | None:
    """Voix de la vidéo : TTS avatar (script) si dispo, sinon audio enregistré."""
    if scenario.voice_mode == "avatar" and scenario.script:
        speech = tts.synthesize(scenario.script, gender=scenario.avatar or "female")
        if speech:
            path = os.path.join(tmp, "voice.mp3")
            with open(path, "wb") as fh:
                fh.write(speech)
            return path
        return None  # TTS non configuré → diaporama silencieux
    if scenario.audio_ref:
        adata, _ = storage.download_bytes(scenario.audio_ref)
        path = os.path.join(tmp, "audio" + (os.path.splitext(scenario.audio_ref)[1] or ".webm"))
        with open(path, "wb") as fh:
            fh.write(adata)
        return path
    return None


def _render_video(scenario: VideoScenario) -> str:
    """Télécharge photos + voix, assemble la vidéo FFmpeg, uploade → clé MinIO."""
    if not scenario.photo_refs:
        raise RuntimeError("no_photos")
    # Défense en profondeur Loi 1 : ne jamais télécharger une ref hors du namespace
    # du tenant (le worker lit MinIO en privilégié, sans RLS de stockage).
    refs = [*scenario.photo_refs, *([scenario.audio_ref] if scenario.audio_ref else [])]
    if not all(owns_ref(scenario.company_id, r) for r in refs):
        raise RuntimeError("foreign_ref")
    with tempfile.TemporaryDirectory() as tmp:
        image_paths: list[str] = []
        for i, ref in enumerate(scenario.photo_refs):
            data, _ct = storage.download_bytes(ref)
            ext = os.path.splitext(ref)[1] or ".jpg"
            path = os.path.join(tmp, f"img_{i:03d}{ext}")
            with open(path, "wb") as fh:
                fh.write(data)
            image_paths.append(path)

        audio_path = _prepare_audio(scenario, tmp)
        # Si on a une voix : caler la durée du diaporama sur celle de la voix
        # (chaque photo dure narration / nb_photos, borné [2 s, 8 s]).
        spp = SECONDS_PER_PHOTO
        if audio_path:
            dur = _probe_duration(audio_path)
            if dur > 0:
                spp = min(8.0, max(2.0, dur / len(image_paths)))

        out_path = os.path.join(tmp, "out.mp4")
        cmd = build_ffmpeg_command(image_paths, audio_path, out_path, seconds_per_image=spp)
        proc = subprocess.run(cmd, capture_output=True, timeout=_FFMPEG_TIMEOUT_S)  # noqa: S603
        if proc.returncode != 0:
            tail = proc.stderr.decode("utf-8", "replace")[-300:]
            raise RuntimeError(f"ffmpeg_failed: {tail}")
        with open(out_path, "rb") as fh:
            video = fh.read()
        key = ffmpeg_output_key(scenario.company_id, scenario.id)
        storage._put_sync(key, video, "video/mp4")  # noqa: SLF001
        return key


@shared_task(name="app.tasks.scenarios.generate", bind=True, max_retries=2)
def generate(self: Any, company_id: str, scenario_id: str) -> dict[str, str]:
    cid = uuid.UUID(company_id)
    sid = uuid.UUID(scenario_id)
    with sync_session_maker() as db:
        db.execute(
            text("SELECT set_config('app.current_company_id', :c, false)"),
            {"c": str(cid)},
        )
        scenario = (
            db.execute(
                select(VideoScenario).where(
                    VideoScenario.id == sid,
                    VideoScenario.company_id == cid,
                    VideoScenario.deleted_at.is_(None),
                )
            )
            .scalars()
            .first()
        )
        if scenario is None:
            return {"status": "not_found", "id": scenario_id}
        if scenario.status == "ready" and scenario.video_url:
            return {"status": "ready", "id": scenario_id}
        try:
            key = _render_video(scenario)
            # Source de vérité = la clé objet (re-signée à la lecture, URL durable).
            # On garde aussi une URL signée pour l'affichage immédiat post-génération.
            scenario.video_object_key = key
            scenario.video_url = storage._presigned_sync(key, VIDEO_URL_TTL)  # noqa: SLF001
            scenario.status = "ready"
            scenario.error = None
            logger.info("scenario %s généré (ffmpeg)", scenario_id)
        except Exception as exc:  # noqa: BLE001 — toute erreur de rendu → failed
            scenario.status = "failed"
            scenario.error = str(exc)[:480]
            logger.exception("scenario %s génération échouée", scenario_id)
        scenario.updated_at = datetime.now(UTC)
        db.commit()
        return {"status": scenario.status, "id": scenario_id}
