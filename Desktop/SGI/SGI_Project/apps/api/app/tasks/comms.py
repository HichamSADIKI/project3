"""Tâches Celery — module Communication.

Queue : notifications
Tâches :
- transcribe_voice_note : transcription Whisper d'une voice note après upload.
- notify_mentions       : notifie les utilisateurs mentionnés dans un message.
"""
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.database import sync_session_maker
from app.models.conversation import ConversationMessage, MessageMention
from app.models.notification import Notification
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.comms.transcribe_voice_note", bind=True, queue="exports")
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
                from app.core.whisper import transcribe_audio
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
        raise self.retry(exc=exc, countdown=60, max_retries=3) from exc


@celery_app.task(name="app.tasks.comms.notify_mentions", bind=True, queue="notifications")
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

            created = 0
            for mention in mentions:
                # Dédup : une notif de mention par (message, utilisateur).
                exists = db.execute(
                    select(Notification.id).where(
                        Notification.company_id == mention.company_id,
                        Notification.type == "message_mention",
                        Notification.recipient_user_id == mention.mentioned_user_id,
                        Notification.payload["message_id"].astext == message_id,
                    )
                ).first()
                if exists:
                    continue
                db.add(
                    Notification(
                        company_id=mention.company_id,
                        recipient_user_id=mention.mentioned_user_id,
                        type="message_mention",
                        channel="in_app",
                        title="Vous avez été mentionné dans une conversation",
                        payload={"message_id": message_id},
                        status="sent",
                        sent_at=datetime.now(UTC),
                    )
                )
                created += 1
            if created:
                db.commit()
            logger.info(
                "notify_mentions: message=%s, %d notification(s) créée(s)",
                message_id, created,
            )
            return {"status": "ok", "notified": created}

    except Exception as exc:
        logger.error("notify_mentions failed: %s", exc)
        raise self.retry(exc=exc, countdown=30, max_retries=3) from exc
