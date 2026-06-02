"""Tâches Celery — module Ticketing SLA (service desk client).

Queue : reminders
Beat :
- check_ticket_sla : toutes les heures — détecte les SLA dépassés, escalade le
  niveau et notifie en in-app (réutilise les helpers purs de
  `app.routers.ticketing.service`).

Scan **cross-tenant** légitime via le rôle privilégié (`sync_session_maker`,
identique à `app.tasks.maintenance`) : le cron doit balayer toutes les sociétés.
La tâche ne lève jamais d'exception au-delà du retry borné — elle ne doit jamais
bloquer le beat.
"""

import logging
import uuid
from datetime import UTC, datetime

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import sync_session_maker  # session synchrone pour Celery
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.routers.ticketing.models import ServiceTicket, ServiceTicketEvent
from app.routers.ticketing.service import escalation_level_for, is_sla_breached

logger = logging.getLogger(__name__)

# Niveau d'escalade → rôles destinataires du fallback quand aucun agent assigné.
_FALLBACK_ROLES: tuple[str, ...] = (UserRole.MANAGER.value, UserRole.ADMIN.value)


def _fallback_recipients(db: Session, company_id: uuid.UUID) -> list[uuid.UUID]:
    """Managers/admins actifs de la société, destinataires si pas d'agent assigné."""
    rows = (
        db.execute(
            select(User.id).where(
                User.company_id == company_id,
                User.role.in_(_FALLBACK_ROLES),
                User.deleted_at.is_(None),
                User.status == "active",
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


def _notify(
    db: Session,
    ticket: ServiceTicket,
    *,
    level: int,
    now: datetime,
) -> int:
    """Crée la (les) notification(s) in-app d'escalade SLA. Renvoie le nb créé.

    Destinataire = agent assigné s'il existe, sinon managers/admins de la société.
    Dédup par (company_id, type, ticket_id, level) pour éviter les doublons à
    chaque passage horaire tant que le niveau ne change pas.
    """
    if ticket.assigned_agent_id is not None:
        recipients: list[uuid.UUID] = [ticket.assigned_agent_id]
    else:
        recipients = _fallback_recipients(db, ticket.company_id)

    created = 0
    for recipient_id in recipients:
        exists = db.execute(
            select(Notification.id).where(
                Notification.company_id == ticket.company_id,
                Notification.type == "ticket_sla_breach",
                Notification.recipient_user_id == recipient_id,
                Notification.payload["ticket_id"].astext == str(ticket.id),
                Notification.payload["level"].astext == str(level),
            )
        ).first()
        if exists:
            continue
        db.add(
            Notification(
                company_id=ticket.company_id,
                recipient_user_id=recipient_id,
                type="ticket_sla_breach",
                channel="in_app",
                title=f"SLA dépassé — ticket {ticket.reference} (niveau {level})",
                body=(
                    f"Priorité {ticket.priority}, échéance {ticket.sla_due_at} "
                    f"dépassée. Escalade niveau {level}."
                ),
                payload={
                    "ticket_id": str(ticket.id),
                    "reference": ticket.reference,
                    "level": level,
                },
                status="sent",
                sent_at=now,
            )
        )
        created += 1
    return created


@shared_task(name="app.tasks.ticketing.check_ticket_sla", bind=True)
def check_ticket_sla(self):
    """Escalade les tickets dont le SLA est dépassé et notifie en in-app.

    Pour chaque ticket non terminé en breach : si le niveau d'escalade calculé
    (`escalation_level_for`) dépasse le niveau courant, on met à jour le ticket,
    on ajoute un event `escalated` (timeline append-only) et on notifie. Ne lève
    jamais au-delà du retry borné.
    """
    now = datetime.now(UTC)
    escalated = 0
    notified = 0
    try:
        with sync_session_maker() as db:
            rows = (
                db.execute(
                    select(ServiceTicket).where(
                        ServiceTicket.deleted_at.is_(None),
                        ServiceTicket.sla_due_at.isnot(None),
                        ServiceTicket.status.notin_(["resolved", "closed"]),
                    )
                )
                .scalars()
                .all()
            )

            checked = len(rows)
            for ticket in rows:
                if not is_sla_breached(ticket.status, ticket.sla_due_at, now):
                    continue
                level = escalation_level_for(ticket.sla_due_at, now)
                if level <= ticket.escalation_level:
                    continue

                old_level = ticket.escalation_level
                ticket.escalation_level = level
                ticket.updated_at = now
                db.add(
                    ServiceTicketEvent(
                        company_id=ticket.company_id,
                        ticket_id=ticket.id,
                        event_type="escalated",
                        actor_user_id=None,
                        body=None,
                        payload={
                            "from": old_level,
                            "to": level,
                            "sla_due_at": (
                                ticket.sla_due_at.isoformat() if ticket.sla_due_at else None
                            ),
                        },
                    )
                )
                notified += _notify(db, ticket, level=level, now=now)
                escalated += 1

            if escalated:
                db.commit()
                logger.warning(
                    "Ticket SLA escalade: %d tickets escaladés (%d notifiés) sur %d vérifiés",
                    escalated,
                    notified,
                    checked,
                )
            return {"checked": checked, "escalated": escalated, "notified": notified}
    except Exception as exc:
        logger.error("check_ticket_sla failed: %s", exc)
        raise self.retry(exc=exc, countdown=300, max_retries=3) from exc
