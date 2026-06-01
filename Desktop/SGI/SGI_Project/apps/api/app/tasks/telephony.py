"""Tâches Celery — module Téléphonie.

- upload_call_recordings  (queue exports)   : scanne le volume des .wav Asterisk,
  rapproche chaque fichier du CDR (channel_id = UNIQUEID), uploade vers MinIO et
  renseigne `recording_url`. Fichiers traités déplacés ; orphelins isolés.
- purge_expired_recordings (queue reminders) : supprime les enregistrements
  au-delà de la rétention PDPL (objet MinIO + anonymisation `recording_url`).

Consommateurs de fond légitimes → rôle privilégié (sync_session_maker), scan
cross-tenant comme les autres tâches cron SGI. On lit le `company_id` de chaque
ligne et on construit la clé objet namespacée par tenant.
"""

import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

from celery import shared_task
from sqlalchemy import select

from app.core import storage
from app.core.config import settings
from app.core.database import sync_session_maker
from app.routers.telephony.models import Call
from app.routers.telephony.recording import (
    build_recording_key,
    channel_id_from_filename,
)

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.telephony.upload_call_recordings", bind=True)
def upload_call_recordings(self):
    """Uploade les .wav du volume Asterisk vers MinIO et les associe aux CDR.

    Rapproche par `channel_id` (UNIQUEID posé au click-to-call). Fichiers traités
    déplacés dans `uploaded/`, orphelins (aucun CDR / pas de consentement) dans
    `orphan/` — jamais supprimés silencieusement.
    """
    monitor = Path(settings.RECORDING_MONITOR_DIR)
    if not monitor.is_dir():
        return {"uploaded": 0, "orphan": 0, "reason": "monitor_dir_absent"}

    uploaded_dir = monitor / "uploaded"
    orphan_dir = monitor / "orphan"
    uploaded_dir.mkdir(exist_ok=True)
    orphan_dir.mkdir(exist_ok=True)

    uploaded = orphan = 0
    with sync_session_maker() as db:
        for wav in monitor.glob("*.wav"):
            channel_id = channel_id_from_filename(wav.name)
            if not channel_id:
                continue
            call = db.execute(select(Call).where(Call.channel_id == channel_id)).scalars().first()
            # Pas de CDR rapprochable, ou consentement absent (PDPL) → orphelin.
            if call is None or not call.recording_consent:
                _move(wav, orphan_dir)
                orphan += 1
                continue
            # Déjà uploadé → on nettoie juste le fichier local.
            if call.recording_url:
                _move(wav, uploaded_dir)
                continue
            try:
                key = build_recording_key(call.company_id, call.id)
                storage._put_sync(key, wav.read_bytes(), "audio/wav")
                call.recording_url = key
                db.commit()
                _move(wav, uploaded_dir)
                uploaded += 1
            except Exception as exc:  # noqa: BLE001 — on n'interrompt pas le lot
                db.rollback()
                logger.warning("upload enregistrement échoué (%s): %s", wav.name, exc)

    logger.info("Enregistrements uploadés: %s · orphelins: %s", uploaded, orphan)
    return {"uploaded": uploaded, "orphan": orphan}


@shared_task(name="app.tasks.telephony.purge_expired_recordings", bind=True)
def purge_expired_recordings(self):
    """Purge PDPL : supprime de MinIO + anonymise les enregistrements expirés.

    Rétention = `RECORDING_RETENTION_DAYS` (<=0 désactive). Scan cross-tenant.
    """
    retention = settings.RECORDING_RETENTION_DAYS
    if retention <= 0:
        return {"purged": 0, "reason": "retention_disabled"}

    cutoff = datetime.now(UTC) - timedelta(days=retention)
    purged = 0
    with sync_session_maker() as db:
        rows = (
            db.execute(
                select(Call).where(
                    Call.recording_url.isnot(None),
                    Call.ended_at.isnot(None),
                    Call.ended_at < cutoff,
                )
            )
            .scalars()
            .all()
        )
        for call in rows:
            storage.delete_object_sync(call.recording_url)
            call.recording_url = None  # anonymisation du CDR
            db.commit()
            purged += 1

    logger.info("Enregistrements purgés (rétention %sj): %s", retention, purged)
    return {"purged": purged}


def _move(src: Path, dest_dir: Path) -> None:
    """Déplace un fichier dans dest_dir (best-effort, n'interrompt pas le lot)."""
    try:
        src.rename(dest_dir / src.name)
    except OSError as exc:
        logger.warning("déplacement %s → %s échoué: %s", src.name, dest_dir, exc)
