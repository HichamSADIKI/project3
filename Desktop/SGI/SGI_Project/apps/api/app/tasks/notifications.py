"""Notification tasks — WhatsApp Meta templates, email Jinja2, push.

Stub volontairement minimal : aucune logique d'envoi ici, juste les
hooks attendus par le routing Celery (queue 'notifications').
À implémenter lorsque les providers seront configurés.
"""

from __future__ import annotations

import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notifications.send_whatsapp_template", queue="notifications")
def send_whatsapp_template(*, to: str, template_id: str, payload: dict) -> dict:
    """Envoi d'un template WhatsApp Meta approuvé. À brancher au provider."""
    logger.info("send_whatsapp_template stub", extra={"to": to, "template": template_id})
    return {"status": "noop", "to": to, "template_id": template_id}


@celery_app.task(name="app.tasks.notifications.send_email", queue="notifications")
def send_email(*, to: str, subject: str, template: str, context: dict) -> dict:
    """Envoi d'un email transactionnel via le provider SMTP. À implémenter."""
    logger.info("send_email stub", extra={"to": to, "template": template})
    return {"status": "noop", "to": to}


@celery_app.task(name="app.tasks.notifications.send_push", queue="notifications")
def send_push(*, user_id: str, title: str, body: str, data: dict | None = None) -> dict:
    """Envoi d'une push notification mobile. À brancher à FCM/APNs."""
    logger.info("send_push stub", extra={"user_id": user_id})
    return {"status": "noop", "user_id": user_id}
