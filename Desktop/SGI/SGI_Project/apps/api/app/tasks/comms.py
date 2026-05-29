"""Tâches Celery — module Communication.

Queue : notifications
Tâches :
- transcribe_voice_note : transcription Whisper d'une voice note après upload.
- notify_mentions       : notifie les utilisateurs mentionnés dans un message.
"""
import logging
import uuid

from celery import shared_task
from sqlalchemy import select

from app.core.database import sync_session_maker
from app.models.conversation import ConversationMessage, MessageMention

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.comms.transcribe_voice_note", bind=True)
def transcribe_voice_note(self, message_id: str, company_id: str) -> dict:
    """Transcrit la voice note d'un message via Whisper et met à jour transcript.

    Déclenché après upload MinIO (attachment_key renseigné, transcript = None).
    """
    import asyncio
    from app.core.storage import StorageError

    try:
        with sync_session_maker() as db:
            msg = db.execute(
                select(ConversationMessage).where(
                    ConversationMessage.id == uuid.UUID(message_id),
                    ConversationMessage.company_id == uuid.UUID(company_id),
                )
            ).scalar_one_or_none()

            if not msg:
                logger.warning("transcribe_voice_note: message %s not found", message_id)
                return {"status": "not_found"}

            if not msg.attachment_key:
                return {"status": "no_attachment"}

            if msg.transcript:
                return {"status": "already_transcribed"}

            # Télécharge depuis MinIO.
            try:
                from app.core.storage import download_bytes
                audio_bytes, content_type = download_bytes(msg.attachment_key)
            except (StorageError, Exception) as exc:
                logger.error("transcribe: download failed: %s", exc)
                return {"status": "download_error", "detail": str(exc)}

            # Transcription Whisper (async dans contexte sync via asyncio.run).
            try:
                from app.core.whisper import transcribe_audio, WhisperUnavailable
                filename = msg.attachment_key.split("/")[-1]
                result = asyncio.run(
                    transcribe_audio(audio_bytes, filename, content_type, "ar")
                )
                transcript_text = result.get("text", "")
                lang = result.get("locale", "ar")
            except Exception as exc:  # noqa: BLE001
                logger.warning("transcribe: whisper failed: %s", exc)
                return {"status": "whisper_error", "detail": str(exc)}

            msg.transcript = transcript_text
            msg.transcript_lang = lang
            db.commit()

            logger.info("transcribed message %s (%d chars)", message_id, len(transcript_text))
            return {"status": "ok", "chars": len(transcript_text), "lang": lang}

    except Exception as exc:
        logger.error("transcribe_voice_note failed: %s", exc)
        raise self.retry(exc=exc, countdown=60, max_retries=3)


@shared_task(name="app.tasks.comms.notify_mentions", bind=True)
def notify_mentions(self, message_id: str, company_id: str) -> dict:
    """Notifie les utilisateurs mentionnés dans un message.

    Phase 4 : log des mentions. Phase 5 (WebSocket) poussera la notification
    en temps réel via `ws.publish_event`.
    """
    try:
        with sync_session_maker() as db:
            mentions = db.execute(
                select(MessageMention).where(
                    MessageMention.message_id == uuid.UUID(message_id),
                    MessageMention.company_id == uuid.UUID(company_id),
                )
            ).scalars().all()

            if not mentions:
                return {"status": "no_mentions"}

            user_ids = [str(m.mentioned_user_id) for m in mentions]
            logger.info(
                "notify_mentions: message=%s users=%s", message_id, user_ids
            )
            # TODO Phase 5 : push notification temps réel via ws.publish_event
            # pour chaque user_id (si connecté).
            return {"status": "ok", "notified": len(user_ids)}

    except Exception as exc:
        logger.error("notify_mentions failed: %s", exc)
        raise self.retry(exc=exc, countdown=30, max_retries=3)
