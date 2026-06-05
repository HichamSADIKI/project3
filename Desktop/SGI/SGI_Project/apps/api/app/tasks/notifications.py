"""Notification tasks — e-mail SMTP (implémenté), WhatsApp/push (stubs).

Le canal e-mail est branché : ``send_email`` envoie réellement via le mailer
(``app.core.mailer``) — backend SMTP en prod, backend « console » (journalisé)
en dev quand ``SMTP_HOST`` est vide. À la livraison, la notification associée
passe ``pending → sent``. WhatsApp et push restent des hooks à brancher quand
les providers (Meta, FCM/APNs) seront configurés.

Routing : queue ``notifications``. Le worker tourne en rôle privilégié
``sgi_user`` (scan multi-tenant cron) ; les updates ciblent quand même
``(id, company_id)`` pour rester corrects vis-à-vis de la Loi 1.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Select, select, update

from app.core import mailer, whatsapp
from app.core.database import sync_session_maker
from app.models.client import Client
from app.models.notification import Notification
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _mark_sent(notification_id: str, company_id: str) -> None:
    """Passe la notification à ``sent`` (idempotent, scopé tenant)."""
    try:
        with sync_session_maker() as db:
            db.execute(
                update(Notification)
                .where(
                    Notification.id == uuid.UUID(notification_id),
                    Notification.company_id == uuid.UUID(company_id),
                )
                .values(status="sent", sent_at=datetime.now(UTC))
            )
            db.commit()
    except Exception:  # pragma: no cover - best-effort, l'e-mail est déjà parti
        logger.exception("send_email: maj statut notification échouée id=%s", notification_id)


@celery_app.task(
    name="app.tasks.notifications.send_email",
    queue="notifications",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_email(
    self,
    *,
    to: str,
    subject: str,
    body: str,
    html: str | None = None,
    notification_id: str | None = None,
    company_id: str | None = None,
) -> dict:
    """Envoie un e-mail transactionnel.

    Backend SMTP si configuré, sinon console (journalisé). En cas d'échec SMTP,
    retry jusqu'à 3× ; un échec définitif laisse la notification en ``pending``
    (visiblement non délivrée) plutôt que de mentir avec ``sent``.
    """
    try:
        result = mailer.send_email(to=to, subject=subject, text_body=body, html_body=html)
    except Exception as exc:
        logger.warning("send_email échec (retry) to=%s: %s", to, exc)
        raise self.retry(exc=exc) from exc

    if notification_id and company_id:
        _mark_sent(notification_id, company_id)

    return {"status": result["backend"], "to": to}


def deliver_email_notification(notif: Notification, *, to: str, html: str | None = None) -> None:
    """Enfile l'envoi e-mail d'une notification (canal ``email``).

    Helper pour les callers : construit les args depuis la notification et
    publie la tâche sur la queue ``notifications``. À appeler après
    ``create_notification(..., channel="email")``.
    """
    send_email.delay(
        to=to,
        subject=notif.title,
        body=notif.body or notif.title,
        html=html,
        notification_id=str(notif.id),
        company_id=str(notif.company_id),
    )


def build_party_email_notification(
    db: Any,
    company_id: uuid.UUID,
    party_id: uuid.UUID | None,
    *,
    notif_type: str,
    title: str,
    body: str,
    payload: dict[str, Any] | None = None,
) -> tuple[Notification, str] | None:
    """Côté worker (session sync) : prépare le doublon e-mail d'une alerte.

    Résout l'e-mail du party (Client) ; s'il existe, construit une notification
    ``channel="email"`` (statut ``pending``, id généré côté Python pour pouvoir
    l'enfiler sans flush) et l'``add`` à la session. Renvoie ``(notif, email)``,
    ou ``None`` si pas de party / pas d'adresse. Le caller **commit** puis appelle
    ``deliver_email_notification(notif, to=email)`` (après commit, pour ne pas
    enfiler un envoi si la transaction est annulée). Scopé ``company_id`` (Loi 1).
    """
    if party_id is None:
        return None
    stmt: Select[tuple[str | None]] = select(Client.email).where(
        Client.id == party_id,
        Client.company_id == company_id,
        Client.deleted_at.is_(None),
    )
    email = db.execute(stmt).scalar_one_or_none()
    if not email:
        return None
    notif = Notification(
        id=uuid.uuid4(),
        company_id=company_id,
        recipient_party_id=party_id,
        type=notif_type,
        channel="email",
        title=title,
        body=body,
        payload=payload or {},
        status="pending",
    )
    db.add(notif)
    return notif, email


@celery_app.task(
    name="app.tasks.notifications.send_whatsapp_template",
    queue="notifications",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_whatsapp_template(
    self,
    *,
    to: str,
    template_name: str,
    language: str | None = None,
    components: list[dict[str, Any]] | None = None,
    notification_id: str | None = None,
    company_id: str | None = None,
) -> dict:
    """Envoi d'un template WhatsApp Meta approuvé.

    Backend Cloud API si configuré, sinon console (journalisé). Retry 3× sur
    erreur API ; à la livraison, passe la notification associée ``pending → sent``.
    """
    try:
        result = whatsapp.send_template(
            to=to, template_name=template_name, language=language, components=components
        )
    except Exception as exc:
        logger.warning("send_whatsapp_template échec (retry) to=%s: %s", to, exc)
        raise self.retry(exc=exc) from exc

    if notification_id and company_id:
        _mark_sent(notification_id, company_id)

    return {"status": result["backend"], "to": to}


def deliver_whatsapp_notification(
    notif: Notification,
    *,
    to: str,
    template_name: str,
    language: str | None = None,
    components: list[dict[str, Any]] | None = None,
) -> None:
    """Enfile l'envoi WhatsApp d'une notification (canal ``whatsapp``).

    À appeler après ``create_notification(..., channel="whatsapp")``. Le contenu
    réel part d'un template Meta approuvé (``template_name``) ; la notification
    sert au suivi de statut (``pending → sent``).
    """
    send_whatsapp_template.delay(
        to=to,
        template_name=template_name,
        language=language,
        components=components,
        notification_id=str(notif.id),
        company_id=str(notif.company_id),
    )


@celery_app.task(name="app.tasks.notifications.send_push", queue="notifications")
def send_push(*, user_id: str, title: str, body: str, data: dict | None = None) -> dict:
    """Envoi d'une push notification mobile. À brancher à FCM/APNs."""
    logger.info("send_push stub", extra={"user_id": user_id})
    return {"status": "noop", "user_id": user_id}
