"""Push mobile via Firebase Cloud Messaging (FCM), avec repli « console » en dev.

Mêmes principes que ``app.core.mailer`` / ``app.core.whatsapp`` :

- ``build_message`` : corps JSON FCM (notification + data) pour un token. Pur.
- ``send_to_token`` : backend « console » (journalisé) si ``FCM_SERVER_KEY`` est
  vide ; sinon ``POST`` sur l'endpoint FCM et lève en cas d'erreur HTTP.

Appel HTTP synchrone (``httpx.post``) — le worker Celery est synchrone.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    """True si une clé serveur FCM est paramétrée (sinon backend console)."""
    return bool(settings.FCM_SERVER_KEY)


def build_message(
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Corps JSON FCM (API legacy) ciblant un token unique."""
    msg: dict[str, Any] = {
        "to": token,
        "notification": {"title": title, "body": body},
    }
    if data:
        msg["data"] = data
    return msg


def send_to_token(
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Envoie un push à un token. Backend console si non configuré.

    Retourne ``{"backend": "console"|"fcm", "token": ...}``. Lève
    ``httpx.HTTPStatusError`` sur erreur API (le caller gère le retry).
    """
    message = build_message(token=token, title=title, body=body, data=data)

    if not is_configured():
        logger.info("push[console] token=%s… title=%r (FCM non configuré)", token[:12], title)
        return {"backend": "console", "token": token}

    headers = {
        "Authorization": f"key={settings.FCM_SERVER_KEY}",
        "Content-Type": "application/json",
    }
    resp = httpx.post(
        settings.FCM_ENDPOINT, json=message, headers=headers, timeout=settings.FCM_TIMEOUT_S
    )
    resp.raise_for_status()
    logger.info("push[fcm] sent token=%s… title=%r", token[:12], title)
    return {"backend": "fcm", "token": token}
