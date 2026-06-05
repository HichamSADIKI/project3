"""Envoi WhatsApp via la Meta Cloud API, avec repli « console » en dev.

Mêmes principes que ``app.core.mailer`` :

- ``build_template_payload`` : construit le corps JSON d'un message *template*
  (le seul type autorisé hors fenêtre de 24 h). Pur, testable sans réseau.
- ``send_template`` : si le compte Meta n'est pas configuré (``WHATSAPP_TOKEN``
  ou ``WHATSAPP_PHONE_NUMBER_ID`` vide), journalise et retourne
  ``{"backend": "console"}`` ; sinon ``POST`` sur l'API Graph et lève en cas
  d'erreur HTTP (la tâche Celery transforme l'échec en retry).

Appel HTTP synchrone (``httpx.post``) car le worker Celery est synchrone —
même pattern que ``app.routers.scenarios.tts``.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    """True si un compte Meta Cloud API est paramétré (sinon backend console)."""
    return bool(settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)


def build_template_payload(
    *,
    to: str,
    template_name: str,
    language: str | None = None,
    components: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Corps JSON d'un message template WhatsApp (Meta Cloud API)."""
    template: dict[str, Any] = {
        "name": template_name,
        "language": {"code": language or settings.WHATSAPP_DEFAULT_LANG},
    }
    if components:
        template["components"] = components
    return {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": template,
    }


def send_template(
    *,
    to: str,
    template_name: str,
    language: str | None = None,
    components: list[dict[str, Any]] | None = None,
) -> dict[str, str]:
    """Envoie un message template. Backend console si non configuré.

    Retourne ``{"backend": "console"|"cloud_api", "to": ...}``. Lève
    ``httpx.HTTPStatusError`` sur erreur API (le caller gère le retry).
    """
    payload = build_template_payload(
        to=to, template_name=template_name, language=language, components=components
    )

    if not is_configured():
        logger.info(
            "whatsapp[console] to=%s template=%s (compte Meta non configuré — non envoyé)",
            to,
            template_name,
        )
        return {"backend": "console", "to": to}

    url = (
        f"{settings.WHATSAPP_BASE_URL}/{settings.WHATSAPP_API_VERSION}"
        f"/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    resp = httpx.post(url, json=payload, headers=headers, timeout=settings.WHATSAPP_TIMEOUT_S)
    resp.raise_for_status()
    logger.info("whatsapp[cloud_api] sent to=%s template=%s", to, template_name)
    return {"backend": "cloud_api", "to": to}
