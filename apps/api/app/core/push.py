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


def is_expo_token(token: str) -> bool:
    """True si le jeton provient de l'app Expo (`ExponentPushToken[...]`)."""
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


def build_expo_message(
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Corps JSON Expo Push API ciblant un jeton unique."""
    msg: dict[str, Any] = {"to": token, "title": title, "body": body, "sound": "default"}
    if data:
        msg["data"] = data
    return msg


def _send_expo(
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Envoi via l'Expo Push API. Backend console si ``EXPO_PUSH_ENABLED`` est
    faux (dev/CI → aucun appel réseau). Lève ``httpx.HTTPStatusError`` sinon."""
    if not settings.EXPO_PUSH_ENABLED:
        logger.info("push[console-expo] token=%s… title=%r (Expo désactivé)", token[:18], title)
        return {"backend": "console", "token": token}

    message = build_expo_message(token=token, title=title, body=body, data=data)
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"
    resp = httpx.post(
        settings.EXPO_PUSH_ENDPOINT, json=message, headers=headers, timeout=settings.FCM_TIMEOUT_S
    )
    resp.raise_for_status()
    logger.info("push[expo] sent token=%s… title=%r", token[:18], title)
    return {"backend": "expo", "token": token}


def send_to_token(
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Envoie un push à un token (route auto Expo vs FCM). Backend console si non
    configuré (FCM sans clé, ou Expo désactivé).

    Retourne ``{"backend": "console"|"fcm"|"expo", "token": ...}``. Lève
    ``httpx.HTTPStatusError`` sur erreur API (le caller gère le retry).
    """
    # Jeton Expo (app mobile #241) → Expo Push API, indépendamment de FCM.
    if is_expo_token(token):
        return _send_expo(token=token, title=title, body=body, data=data)

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
