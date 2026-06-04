"""Service Scenarios — helpers purs + fonctions DB (filtrées company_id, Loi 1).

Génération vidéo **réelle** via FFmpeg (diaporama 9:16 + voix enregistrée),
exécutée en tâche de fond (`app/tasks/scenarios.py`). Helpers purs ici :
`build_ffmpeg_command` (argv FFmpeg, testable) + `ffmpeg_output_key`.
`run_stub_generation` est conservé comme repli déterministe (tests / lien social).
La voix d'avatar (TTS) reste à brancher — sans audio le diaporama est silencieux.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.scenarios.models import VideoScenario

AVATARS: tuple[str, ...] = ("male", "female")
VOICE_MODES: frozenset[str] = frozenset({"avatar", "recorded"})
LISTING_TYPES: frozenset[str] = frozenset({"sale", "rent"})
STATUSES: frozenset[str] = frozenset({"draft", "generating", "ready", "failed"})

# Vidéo placeholder (repli — utilisé par les tests/social pour fabriquer un ready).
_STUB_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
MAX_PHOTOS = 10

# Sortie vidéo réelle (FFmpeg) — format vertical 9:16 réseaux sociaux.
VIDEO_WIDTH, VIDEO_HEIGHT = 1080, 1920
SECONDS_PER_PHOTO = 3.0
VIDEO_URL_TTL = 7 * 24 * 3600  # 7 j (expiration max d'une URL signée MinIO)


# ── Helpers purs (sans DB) ───────────────────────────────────────────────────


def is_valid_avatar(avatar: str) -> bool:
    return avatar in AVATARS


def is_valid_voice_mode(mode: str) -> bool:
    return mode in VOICE_MODES


def is_valid_listing_type(listing_type: str) -> bool:
    return listing_type in LISTING_TYPES


def avatar_voice_label(avatar: str | None) -> str:
    """Libellé de la voix générée selon l'avatar choisi (pur, testable)."""
    return {"male": "voix masculine", "female": "voix féminine"}.get(avatar or "", "voix")


def stub_video_url(scenario_id: uuid.UUID) -> str:
    """URL de la vidéo générée (stub déterministe). `scenario_id` en fragment."""
    return f"{_STUB_VIDEO}#scenario={scenario_id.hex[:8]}"


def ffmpeg_output_key(company_id: uuid.UUID, scenario_id: uuid.UUID) -> str:
    """Clé objet MinIO de la vidéo générée. Pur, testable."""
    return f"scenarios/{company_id}/videos/{scenario_id.hex}.mp4"


def owns_ref(company_id: uuid.UUID, ref: str) -> bool:
    """Vrai si la clé MinIO `ref` appartient au tenant (préfixe `scenarios/{company_id}/`).

    Garde-fou **Loi 1 sur le stockage** : le bucket MinIO est partagé et sans RLS,
    donc une ref fournie par le client doit être contrainte au namespace du tenant,
    sinon un scénario pourrait référencer (et faire encoder) le fichier d'un autre
    tenant. Pur, testable.
    """
    return ref.startswith(f"scenarios/{company_id}/")


def build_ffmpeg_command(
    image_paths: list[str],
    audio_path: str | None,
    out_path: str,
    *,
    seconds_per_image: float = SECONDS_PER_PHOTO,
    width: int = VIDEO_WIDTH,
    height: int = VIDEO_HEIGHT,
) -> list[str]:
    """Construit l'argv FFmpeg d'un diaporama 9:16 (+ audio optionnel). Pur, testable.

    Chaque photo est mise à l'échelle puis letterboxée en `width`×`height`, les
    plans sont concaténés ; l'audio (voix enregistrée) est mappé avec `-shortest`.
    Sortie H.264 / yuv420p (compatible Instagram/TikTok/WhatsApp).
    """
    if not image_paths:
        raise ValueError("at_least_one_image_required")
    cmd: list[str] = ["ffmpeg", "-y"]
    for path in image_paths:
        cmd += ["-loop", "1", "-t", f"{seconds_per_image:.2f}", "-i", path]
    if audio_path:
        cmd += ["-i", audio_path]
    n = len(image_paths)
    filters: list[str] = []
    for i in range(n):
        filters.append(
            f"[{i}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,"
            f"format=yuv420p[v{i}]"
        )
    concat_inputs = "".join(f"[v{i}]" for i in range(n))
    filters.append(f"{concat_inputs}concat=n={n}:v=1:a=0[v]")
    cmd += ["-filter_complex", ";".join(filters), "-map", "[v]"]
    if audio_path:
        cmd += ["-map", f"{n}:a", "-shortest"]
    cmd += [
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-movflags",
        "+faststart",
        out_path,
    ]
    return cmd


# ── Fonctions DB (Loi 1 : toujours filtrer company_id) ───────────────────────


async def list_scenarios(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_type: str | None = None,
    listing_id: uuid.UUID | None = None,
    limit: int = 200,
) -> list[VideoScenario]:
    q = select(VideoScenario).where(
        VideoScenario.company_id == company_id,
        VideoScenario.deleted_at.is_(None),
    )
    if listing_type is not None:
        q = q.where(VideoScenario.listing_type == listing_type)
    if listing_id is not None:
        q = q.where(VideoScenario.listing_id == listing_id)
    q = q.order_by(VideoScenario.created_at.desc()).limit(limit)
    return list((await db.execute(q)).scalars().all())


async def get_scenario(
    db: AsyncSession, company_id: uuid.UUID, scenario_id: uuid.UUID
) -> VideoScenario | None:
    q = select(VideoScenario).where(
        VideoScenario.id == scenario_id,
        VideoScenario.company_id == company_id,
        VideoScenario.deleted_at.is_(None),
    )
    return (await db.execute(q)).scalar_one_or_none()


async def create_scenario(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_type: str,
    listing_id: uuid.UUID,
    voice_mode: str,
    photo_refs: list[str],
    title: str | None = None,
    avatar: str | None = None,
    script: str | None = None,
    audio_ref: str | None = None,
) -> VideoScenario:
    """Crée un scénario en statut `generating` (la génération est déclenchée après)."""
    scenario = VideoScenario(
        company_id=company_id,
        listing_type=listing_type,
        listing_id=listing_id,
        title=title,
        voice_mode=voice_mode,
        avatar=avatar,
        script=script,
        photo_refs=photo_refs,
        audio_ref=audio_ref,
        status="generating",
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


async def soft_delete(
    db: AsyncSession, company_id: uuid.UUID, scenario_id: uuid.UUID
) -> VideoScenario | None:
    scenario = await get_scenario(db, company_id, scenario_id)
    if scenario is None:
        return None
    now = datetime.now(UTC)
    scenario.deleted_at = now
    scenario.updated_at = now
    await db.commit()
    return scenario


async def mark_generating(
    db: AsyncSession, company_id: uuid.UUID, scenario_id: uuid.UUID
) -> VideoScenario | None:
    """Repasse un scénario en `generating` (relance), efface vidéo/erreur."""
    scenario = await get_scenario(db, company_id, scenario_id)
    if scenario is None:
        return None
    scenario.status = "generating"
    scenario.video_url = None
    scenario.error = None
    scenario.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(scenario)
    return scenario


async def run_stub_generation(
    db: AsyncSession, company_id: uuid.UUID, scenario_id: uuid.UUID
) -> VideoScenario | None:
    """STUB de génération : `generating` → `ready` + URL vidéo placeholder.

    Idempotent : ne régénère pas une vidéo déjà prête. Remplacer le corps par un
    vrai appel fournisseur (photos+script+avatar → vidéo) sans changer la signature.
    """
    scenario = await get_scenario(db, company_id, scenario_id)
    if scenario is None:
        return None
    if scenario.status == "ready" and scenario.video_url:
        return scenario
    scenario.status = "ready"
    scenario.video_url = stub_video_url(scenario.id)
    scenario.error = None
    scenario.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(scenario)
    return scenario
