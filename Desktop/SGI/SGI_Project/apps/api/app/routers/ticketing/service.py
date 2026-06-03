"""Service Ticketing SLA.

- **Helpers purs** (sans DB) : priorités, SLA, machine à états, escalade.
- **Fonctions DB** : filtrées par company_id (Loi 1) + timeline d'événements.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.ticketing.models import ServiceTicket, ServiceTicketEvent

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs
# ─────────────────────────────────────────────────────────────────────────

PRIORITIES: frozenset[str] = frozenset({"low", "medium", "high", "urgent"})
STATUSES: frozenset[str] = frozenset({"open", "in_progress", "pending", "resolved", "closed"})
TERMINAL_STATUSES: frozenset[str] = frozenset({"resolved", "closed"})

# Délai SLA de résolution par priorité (minutes).
SLA_MINUTES: dict[str, int] = {
    "urgent": 60,
    "high": 4 * 60,
    "medium": 24 * 60,
    "low": 48 * 60,
}

_TRANSITIONS: dict[str, frozenset[str]] = {
    "open": frozenset({"in_progress", "pending", "resolved", "closed"}),
    "in_progress": frozenset({"pending", "resolved", "closed"}),
    "pending": frozenset({"in_progress", "resolved", "closed"}),
    # Réouverture depuis un état terminal.
    "resolved": frozenset({"in_progress", "closed"}),
    "closed": frozenset({"in_progress"}),
}


def generate_reference(year: int, sequence: int) -> str:
    """Référence triable : `TCK-2026-000042`."""
    return f"TCK-{year:04d}-{sequence:06d}"


def is_valid_transition(current: str, target: str) -> bool:
    if current not in STATUSES or target not in STATUSES or current == target:
        return False
    return target in _TRANSITIONS.get(current, frozenset())


def compute_sla_due(priority: str, created_at: datetime) -> datetime:
    """Échéance SLA de résolution selon la priorité."""
    minutes = SLA_MINUTES.get(priority, SLA_MINUTES["medium"])
    base = created_at if created_at.tzinfo else created_at.replace(tzinfo=UTC)
    return base + timedelta(minutes=minutes)


def is_sla_breached(status: str, sla_due_at: datetime | None, now: datetime) -> bool:
    """True si le SLA est dépassé et le ticket non terminé."""
    if status in TERMINAL_STATUSES or sla_due_at is None:
        return False
    due = sla_due_at if sla_due_at.tzinfo else sla_due_at.replace(tzinfo=UTC)
    return now > due


def escalation_level_for(sla_due_at: datetime | None, now: datetime) -> int:
    """Niveau d'escalade selon l'ampleur du dépassement SLA.

    0 = dans les temps ; 1 = dépassé ; 2 = dépassé de +100 % du délai écoulé
    depuis l'échéance (retard prolongé). Pur, utilisé par la tâche d'escalade.
    """
    if sla_due_at is None:
        return 0
    due = sla_due_at if sla_due_at.tzinfo else sla_due_at.replace(tzinfo=UTC)
    if now <= due:
        return 0
    overdue_hours = (now - due).total_seconds() / 3600
    return 2 if overdue_hours >= 24 else 1


# ─────────────────────────────────────────────────────────────────────────
# Fonctions DB — filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


async def next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    year = datetime.now(UTC).year
    # Verrou consultatif transactionnel (libéré au COMMIT) : sérialise les
    # créations concurrentes du même tenant/année → COUNT+INSERT race-free
    # (plus de collision de référence ni d'IntegrityError 500 transitoire).
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
        {"k": f"TCK:{company_id}:{year}"},
    )
    result = await db.execute(
        select(func.count())
        .select_from(ServiceTicket)
        .where(
            ServiceTicket.company_id == company_id,
            ServiceTicket.reference.like(f"TCK-{year:04d}-%"),
        )
    )
    return generate_reference(year, result.scalar_one() + 1)


async def _add_event(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    *,
    event_type: str,
    actor_user_id: uuid.UUID | None = None,
    body: str | None = None,
    payload: dict[str, Any] | None = None,
) -> ServiceTicketEvent:
    event = ServiceTicketEvent(
        company_id=company_id,
        ticket_id=ticket_id,
        event_type=event_type,
        actor_user_id=actor_user_id,
        body=body,
        payload=payload or {},
    )
    db.add(event)
    return event


async def create_ticket(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    subject: str,
    description: str | None = None,
    category: str | None = None,
    priority: str = "medium",
    requester_client_id: uuid.UUID | None = None,
    actor_user_id: uuid.UUID | None = None,
) -> ServiceTicket:
    now = datetime.now(UTC)
    ticket = ServiceTicket(
        company_id=company_id,
        reference=await next_reference(db, company_id),
        subject=subject,
        description=description,
        category=category,
        priority=priority,
        status="open",
        requester_client_id=requester_client_id,
        sla_due_at=compute_sla_due(priority, now),
    )
    db.add(ticket)
    await db.flush()
    await _add_event(db, company_id, ticket.id, event_type="created", actor_user_id=actor_user_id)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def get_ticket(
    db: AsyncSession, company_id: uuid.UUID, ticket_id: uuid.UUID
) -> ServiceTicket | None:
    result = await db.execute(
        select(ServiceTicket).where(
            ServiceTicket.id == ticket_id,
            ServiceTicket.company_id == company_id,
            ServiceTicket.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_tickets(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    priority: str | None = None,
    assigned_agent_id: uuid.UUID | None = None,
    requester_client_id: uuid.UUID | None = None,
) -> tuple[list[ServiceTicket], int]:
    base = select(ServiceTicket).where(
        ServiceTicket.company_id == company_id,
        ServiceTicket.deleted_at.is_(None),
    )
    if status:
        base = base.where(ServiceTicket.status == status)
    if priority:
        base = base.where(ServiceTicket.priority == priority)
    if assigned_agent_id:
        base = base.where(ServiceTicket.assigned_agent_id == assigned_agent_id)
    if requester_client_id:
        base = base.where(ServiceTicket.requester_client_id == requester_client_id)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(ServiceTicket.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_ticket(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    new_status: str,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> ServiceTicket | None:
    ticket = await get_ticket(db, company_id, ticket_id)
    if ticket is None:
        return None
    if not is_valid_transition(ticket.status, new_status):
        raise ValueError(f"invalid_transition:{ticket.status}->{new_status}")
    now = datetime.now(UTC)
    old = ticket.status
    ticket.status = new_status
    if new_status == "resolved" and ticket.resolved_at is None:
        ticket.resolved_at = now
    if ticket.first_response_at is None and new_status in ("in_progress", "pending", "resolved"):
        ticket.first_response_at = now
    ticket.updated_at = now
    await _add_event(
        db,
        company_id,
        ticket.id,
        event_type="status_changed",
        actor_user_id=actor_user_id,
        payload={"from": old, "to": new_status},
    )
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def assign_ticket(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    agent_user_id: uuid.UUID,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> ServiceTicket | None:
    ticket = await get_ticket(db, company_id, ticket_id)
    if ticket is None:
        return None
    now = datetime.now(UTC)
    ticket.assigned_agent_id = agent_user_id
    if ticket.status == "open":
        ticket.status = "in_progress"
        # Cohérent avec transition_ticket : l'assignation open→in_progress est la
        # première réponse → horodater le SLA de première réponse (sinon NULL à vie).
        if ticket.first_response_at is None:
            ticket.first_response_at = now
    ticket.updated_at = now
    await _add_event(
        db,
        company_id,
        ticket.id,
        event_type="assigned",
        actor_user_id=actor_user_id,
        payload={"agent_user_id": str(agent_user_id)},
    )
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def add_comment(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    body: str,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> ServiceTicketEvent | None:
    ticket = await get_ticket(db, company_id, ticket_id)
    if ticket is None:
        return None
    event = await _add_event(
        db, company_id, ticket.id, event_type="commented", actor_user_id=actor_user_id, body=body
    )
    await db.commit()
    await db.refresh(event)
    return event


async def list_events(
    db: AsyncSession, company_id: uuid.UUID, ticket_id: uuid.UUID
) -> list[ServiceTicketEvent]:
    rows = (
        (
            await db.execute(
                select(ServiceTicketEvent)
                .where(
                    ServiceTicketEvent.company_id == company_id,
                    ServiceTicketEvent.ticket_id == ticket_id,
                )
                .order_by(ServiceTicketEvent.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    return list(rows)
