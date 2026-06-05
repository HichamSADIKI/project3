"""Mailer transactionnel — envoi SMTP avec repli « console » en dev.

Deux responsabilités séparées (testables sans réseau) :

- ``build_message`` : construit un ``EmailMessage`` MIME (multipart alternative
  si un corps HTML est fourni). Pur, déterministe → couvert en unitaire.
- ``send_email`` : choisit le backend. Si ``SMTP_HOST`` est vide, on journalise
  l'e-mail (backend console) et on retourne ``{"backend": "console"}`` ; sinon on
  ouvre une connexion ``smtplib`` (STARTTLS optionnel) et on envoie réellement.

Aucune dépendance externe : stdlib ``smtplib`` + ``email`` (le worker Celery est
synchrone, pas besoin d'aiosmtplib). Toute erreur SMTP remonte au caller (la
tâche Celery la transforme en statut ``failed`` sur la notification).
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

logger = logging.getLogger(__name__)


def build_message(
    *,
    to: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
    from_addr: str | None = None,
    from_name: str | None = None,
) -> EmailMessage:
    """Assemble un e-mail MIME. ``html_body`` optionnel → alternative texte/HTML."""
    msg = EmailMessage()
    msg["From"] = formataddr(
        (from_name or settings.SMTP_FROM_NAME, from_addr or settings.SMTP_FROM)
    )
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text_body or "")
    if html_body:
        msg.add_alternative(html_body, subtype="html")
    return msg


def is_configured() -> bool:
    """True si un relais SMTP est paramétré (sinon backend console)."""
    return bool(settings.SMTP_HOST)


def send_email(
    *,
    to: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> dict[str, str]:
    """Envoie l'e-mail. Backend console si SMTP non configuré.

    Retourne ``{"backend": "smtp"|"console", "to": ...}``. Lève en cas
    d'échec SMTP (connexion, auth, refus) — le caller décide du retry/statut.
    """
    msg = build_message(to=to, subject=subject, text_body=text_body, html_body=html_body)

    if not is_configured():
        logger.info(
            "email[console] to=%s subject=%r (SMTP non configuré — non envoyé)",
            to,
            subject,
        )
        return {"backend": "console", "to": to}

    with smtplib.SMTP(
        settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_S
    ) as smtp:
        smtp.ehlo()
        if settings.SMTP_STARTTLS:
            smtp.starttls()
            smtp.ehlo()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(msg)

    logger.info("email[smtp] sent to=%s subject=%r", to, subject)
    return {"backend": "smtp", "to": to}
