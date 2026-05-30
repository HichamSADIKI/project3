"""Service Maintenance — logique métier, helpers purs + CRUD.

Toutes les fonctions filtrent par company_id (Loi 1).
Les helpers purs (generate_reference, is_valid_transition, compute_sla_due,
is_sla_breached) sont testables sans DB.
"""
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.maintenance import MaintenanceTicket
from app.models.maintenance_ext import MaintenanceInvoice, MaintenancePlan, MaintenanceQuote
from app.models.vendor_mission import VendorMission

from .schemas import (
    InvoiceCreate,
    PlanCreate,
    PlanUpdate,
    QuoteCreate,
    TicketAssign,
    TicketCreate,
    TicketStatusUpdate,
    TicketUpdate,
)

# ── Machine à états ───────────────────────────────────────────────────────

VALID_TRANSITIONS: dict[str, list[str]] = {
    "new":         ["triaged", "assigned", "cancelled"],
    "triaged":     ["assigned", "cancelled"],
    "assigned":    ["in_progress", "cancelled"],
    "in_progress": ["on_hold", "resolved", "cancelled"],
    "on_hold":     ["in_progress", "cancelled"],
    "resolved":    ["closed", "in_progress"],   # réouverture possible
    "closed":      [],                           # terminal
    "cancelled":   [],                           # terminal
}

# ── SLA par priorité ─────────────────────────────────────────────────────

SLA_HOURS: dict[str, int] = {
    "urgent": 4,
    "high":   24,
    "medium": 72,
    "low":    168,  # 7 jours
}


# ── Helpers purs (testables sans DB) ─────────────────────────────────────

def generate_reference(year: int, sequence: int) -> str:
    """Format : MNT-YYYY-NNNNNN (6 chiffres, triable)."""
    return f"MNT-{year}-{sequence:06d}"


def is_valid_transition(current: str, target: str) -> bool:
    """Valide la transition de statut selon la machine à états."""
    return target in VALID_TRANSITIONS.get(current, [])


def compute_sla_due(priority: str, created_at: datetime) -> datetime:
    """Calcule la date limite SLA à partir de la priorité et de la création."""
    hours = SLA_HOURS.get(priority, SLA_HOURS["medium"])
    base = created_at
    if base.tzinfo is None:
        base = base.replace(tzinfo=UTC)
    return base + timedelta(hours=hours)


def is_sla_breached(ticket: MaintenanceTicket) -> bool:
    """True si le SLA est dépassé et le ticket non clôturé."""
    if ticket.status in ("closed", "cancelled", "resolved"):
        return False
    if ticket.sla_due_at is None:
        return False
    due = ticket.sla_due_at
    if due.tzinfo is None:
        due = due.replace(tzinfo=UTC)
    return datetime.now(UTC) > due


# ── Parsing cron (sans dépendance externe) ─────────────────────────────────

# Champs cron standard : minute heure jour-du-mois mois jour-de-semaine.
# Bornes (min, max) par position.
_CRON_BOUNDS = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 6)]


def _parse_cron_field(field: str, lo: int, hi: int) -> set[int]:
    """Parse un champ cron en l'ensemble des valeurs autorisées.

    Gère `*`, listes `a,b`, plages `a-b`, pas `*/n` et `a-b/n`. Pour le champ
    jour-de-semaine, 7 est ramené à 0 (dimanche). Lève ValueError si invalide.
    """
    values: set[int] = set()
    for part in field.split(","):
        step = 1
        if "/" in part:
            part, step_str = part.split("/", 1)
            step = int(step_str)
            if step <= 0:
                raise ValueError("step must be > 0")
        if part == "*":
            start, end = lo, hi
        elif "-" in part:
            a, b = part.split("-", 1)
            start, end = int(a), int(b)
        else:
            start = end = int(part)
        if start > end or start < lo or end > hi:
            raise ValueError(f"field out of range [{lo},{hi}]: {part}")
        values.update(range(start, end + 1, step))
    # Dimanche accepté comme 7 → normalisé en 0.
    if hi == 6 and 7 in values:  # défense (non atteignable via bornes ci-dessus)
        values.discard(7)
        values.add(0)
    return values


def _cron_matches(expr_sets: list[set[int]], moment: datetime) -> bool:
    """True si `moment` (à la minute) satisfait l'expression cron parsée.

    Sémantique standard : si jour-du-mois ET jour-de-semaine sont tous deux
    restreints (≠ *), la correspondance est un OU entre les deux.
    """
    minute, hour, dom, month, dow = expr_sets
    if moment.minute not in minute or moment.hour not in hour or moment.month not in month:
        return False
    # cron : dimanche = 0 ; Python weekday() : lundi = 0, dimanche = 6.
    py_dow = (moment.weekday() + 1) % 7
    dom_restricted = dom != set(range(1, 32))
    dow_restricted = dow != set(range(0, 7))
    dom_ok = moment.day in dom
    dow_ok = py_dow in dow
    if dom_restricted and dow_restricted:
        return dom_ok or dow_ok
    return dom_ok and dow_ok


def next_cron_run(
    cron_expression: str, after: datetime, max_days: int = 366
) -> datetime | None:
    """Renvoie la prochaine occurrence STRICTEMENT après `after`, ou None.

    Helper pur sans dépendance (cron 5 champs). Recherche minute par minute
    dans une fenêtre bornée (`max_days`) ; None si l'expression est invalide
    ou si aucune occurrence n'est trouvée dans la fenêtre — l'appelant peut
    alors retomber sur un intervalle par défaut.
    """
    fields = cron_expression.split()
    if len(fields) != 5:
        return None
    try:
        expr_sets = [
            _parse_cron_field(f, lo, hi)
            for f, (lo, hi) in zip(fields, _CRON_BOUNDS, strict=True)
        ]
    except (ValueError, TypeError):
        return None

    base = after if after.tzinfo else after.replace(tzinfo=UTC)
    # On part de la minute suivante (occurrence strictement postérieure).
    candidate = (base + timedelta(minutes=1)).replace(second=0, microsecond=0)
    limit = base + timedelta(days=max_days)
    while candidate <= limit:
        if _cron_matches(expr_sets, candidate):
            return candidate
        candidate += timedelta(minutes=1)
    return None


# ── Génération de référence (async, DB) ───────────────────────────────────

async def _next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    """Référence séquentielle unique par tenant + année."""
    year = datetime.now(UTC).year
    count_result = await db.execute(
        select(func.count(MaintenanceTicket.id)).where(
            MaintenanceTicket.company_id == company_id,
            func.extract("year", MaintenanceTicket.created_at) == year,
        )
    )
    seq = int(count_result.scalar_one() or 0) + 1
    return generate_reference(year, seq)


# ── CRUD ──────────────────────────────────────────────────────────────────

async def list_tickets(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    unit_id: uuid.UUID | None = None,
    assignee_id: uuid.UUID | None = None,
    q: str | None = None,
) -> tuple[list[MaintenanceTicket], int]:
    """Retourne (items, total) filtrés par company_id."""
    filters = [
        MaintenanceTicket.company_id == company_id,
        MaintenanceTicket.deleted_at.is_(None),
    ]
    if status:
        filters.append(MaintenanceTicket.status == status)
    if priority:
        filters.append(MaintenanceTicket.priority == priority)
    if category:
        filters.append(MaintenanceTicket.category == category)
    if unit_id:
        filters.append(MaintenanceTicket.unit_id == unit_id)
    if assignee_id:
        filters.append(
            or_(
                MaintenanceTicket.assigned_technician_id == assignee_id,
                MaintenanceTicket.assigned_vendor_party_id == assignee_id,
            )
        )
    if q:
        filters.append(
            or_(
                MaintenanceTicket.title.ilike(f"%{q}%"),
                MaintenanceTicket.description.ilike(f"%{q}%"),
                MaintenanceTicket.reference.ilike(f"%{q}%"),
            )
        )

    total = (
        await db.execute(
            select(func.count()).select_from(MaintenanceTicket).where(and_(*filters))
        )
    ).scalar_one()

    offset = (page - 1) * limit
    result = await db.execute(
        select(MaintenanceTicket)
        .where(and_(*filters))
        .order_by(
            MaintenanceTicket.sla_due_at.asc().nulls_last(),
            MaintenanceTicket.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_ticket(
    db: AsyncSession, company_id: uuid.UUID, ticket_id: uuid.UUID
) -> MaintenanceTicket | None:
    result = await db.execute(
        select(MaintenanceTicket).where(
            MaintenanceTicket.id == ticket_id,
            MaintenanceTicket.company_id == company_id,
            MaintenanceTicket.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_ticket(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: TicketCreate,
    user_id: uuid.UUID,
) -> MaintenanceTicket:
    if not data.unit_id and not data.building_id:
        raise HTTPException(status_code=422, detail="unit_id_or_building_id_required")

    reference = await _next_reference(db, company_id)
    now = datetime.now(UTC)
    sla_due = compute_sla_due(data.priority, now)

    ticket = MaintenanceTicket(
        company_id=company_id,
        reference=reference,
        unit_id=data.unit_id,
        building_id=data.building_id,
        reported_by_user_id=user_id,
        reporter_role=data.reporter_role,
        category=data.category,
        priority=data.priority,
        status="new",
        title=data.title,
        description=data.description,
        sla_due_at=sla_due,
        cost_estimate_aed=data.cost_estimate_aed,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def update_ticket(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    data: TicketUpdate,
) -> MaintenanceTicket | None:
    ticket = await get_ticket(db, company_id, ticket_id)
    if not ticket:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ticket, field, value)
    # Si la priorité change, recalcule le SLA.
    if data.priority:
        ticket.sla_due_at = compute_sla_due(data.priority, ticket.created_at)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def assign_ticket(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    data: TicketAssign,
    assigning_user_id: uuid.UUID,
) -> MaintenanceTicket | None:
    """Assigne le ticket à un technicien OU un vendor (pas les deux).

    Si vendor : crée automatiquement une VendorMission.
    """
    if not data.technician_id and not data.vendor_party_id:
        raise HTTPException(status_code=422, detail="technician_id_or_vendor_party_id_required")
    if data.technician_id and data.vendor_party_id:
        raise HTTPException(status_code=422, detail="assign_to_one_only")

    ticket = await get_ticket(db, company_id, ticket_id)
    if not ticket:
        return None

    if data.technician_id:
        ticket.assigned_technician_id = data.technician_id
        ticket.assigned_vendor_party_id = None
        ticket.vendor_mission_id = None
        ticket.status = "assigned"

    elif data.vendor_party_id:
        ticket.assigned_vendor_party_id = data.vendor_party_id
        ticket.assigned_technician_id = None
        ticket.status = "assigned"

        # Crée la vendor_mission automatiquement à l'assignation.
        mission = VendorMission(
            company_id=company_id,
            vendor_party_id=data.vendor_party_id,
            title=f"[MNT] {ticket.reference} — {ticket.title}",
            description=ticket.description,
            status="assigned",
            created_by_user_id=assigning_user_id,
        )
        db.add(mission)
        await db.flush()
        ticket.vendor_mission_id = mission.id

    await db.commit()
    await db.refresh(ticket)
    return ticket


async def update_ticket_status(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    data: TicketStatusUpdate,
) -> MaintenanceTicket | None:
    ticket = await get_ticket(db, company_id, ticket_id)
    if not ticket:
        return None

    if not is_valid_transition(ticket.status, data.status):
        raise HTTPException(
            status_code=422,
            detail=(
                f"invalid_transition: '{ticket.status}' → '{data.status}' "
                f"(autorisées: {VALID_TRANSITIONS.get(ticket.status, [])})"
            ),
        )

    ticket.status = data.status
    if data.status in ("resolved", "closed"):
        ticket.resolved_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(ticket)
    return ticket


async def soft_delete_ticket(
    db: AsyncSession, company_id: uuid.UUID, ticket_id: uuid.UUID
) -> bool:
    ticket = await get_ticket(db, company_id, ticket_id)
    if not ticket:
        return False
    ticket.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


# ── Phase 2 : Devis (Quotes) ──────────────────────────────────────────────

async def create_quote(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    data: QuoteCreate,
) -> MaintenanceQuote | None:
    ticket = await get_ticket(db, company_id, ticket_id)
    if not ticket:
        return None
    quote = MaintenanceQuote(
        company_id=company_id,
        ticket_id=ticket_id,
        vendor_party_id=data.vendor_party_id,
        amount_aed=data.amount_aed,
        valid_until=data.valid_until,
        notes=data.notes,
        status="pending",
    )
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return quote


async def get_quote(
    db: AsyncSession, company_id: uuid.UUID, quote_id: uuid.UUID
) -> MaintenanceQuote | None:
    result = await db.execute(
        select(MaintenanceQuote).where(
            MaintenanceQuote.id == quote_id,
            MaintenanceQuote.company_id == company_id,
            MaintenanceQuote.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def approve_quote(
    db: AsyncSession, company_id: uuid.UUID, quote_id: uuid.UUID
) -> MaintenanceQuote | None:
    quote = await get_quote(db, company_id, quote_id)
    if not quote:
        return None
    if quote.status != "pending":
        raise HTTPException(status_code=422, detail="quote_not_pending")
    quote.status = "approved"
    # Met à jour le coût estimé du ticket.
    ticket = await get_ticket(db, company_id, quote.ticket_id)
    if ticket:
        ticket.cost_estimate_aed = quote.amount_aed
    await db.commit()
    await db.refresh(quote)
    return quote


async def reject_quote(
    db: AsyncSession, company_id: uuid.UUID, quote_id: uuid.UUID
) -> MaintenanceQuote | None:
    quote = await get_quote(db, company_id, quote_id)
    if not quote:
        return None
    if quote.status != "pending":
        raise HTTPException(status_code=422, detail="quote_not_pending")
    quote.status = "rejected"
    await db.commit()
    await db.refresh(quote)
    return quote


async def list_quotes(
    db: AsyncSession, company_id: uuid.UUID, ticket_id: uuid.UUID
) -> list[MaintenanceQuote]:
    result = await db.execute(
        select(MaintenanceQuote).where(
            MaintenanceQuote.ticket_id == ticket_id,
            MaintenanceQuote.company_id == company_id,
            MaintenanceQuote.deleted_at.is_(None),
        ).order_by(MaintenanceQuote.created_at.desc())
    )
    return list(result.scalars().all())


# ── Phase 2 : Factures (Invoices) ─────────────────────────────────────────

async def create_invoice(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    data: InvoiceCreate,
) -> MaintenanceInvoice | None:
    ticket = await get_ticket(db, company_id, ticket_id)
    if not ticket:
        return None
    invoice = MaintenanceInvoice(
        company_id=company_id,
        ticket_id=ticket_id,
        vendor_party_id=data.vendor_party_id,
        amount_aed=data.amount_aed,
        due_date=data.due_date,
        status="draft",
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


async def list_invoices(
    db: AsyncSession, company_id: uuid.UUID, ticket_id: uuid.UUID
) -> list[MaintenanceInvoice]:
    result = await db.execute(
        select(MaintenanceInvoice).where(
            MaintenanceInvoice.ticket_id == ticket_id,
            MaintenanceInvoice.company_id == company_id,
            MaintenanceInvoice.deleted_at.is_(None),
        ).order_by(MaintenanceInvoice.created_at.desc())
    )
    return list(result.scalars().all())


# ── Phase 2 : Plans préventifs ────────────────────────────────────────────

async def list_plans(
    db: AsyncSession, company_id: uuid.UUID, active_only: bool = False
) -> list[MaintenancePlan]:
    filters = [
        MaintenancePlan.company_id == company_id,
        MaintenancePlan.deleted_at.is_(None),
    ]
    if active_only:
        filters.append(MaintenancePlan.active.is_(True))
    result = await db.execute(
        select(MaintenancePlan).where(and_(*filters))
        .order_by(MaintenancePlan.next_due_at.asc().nulls_last())
    )
    return list(result.scalars().all())


async def create_plan(
    db: AsyncSession, company_id: uuid.UUID, data: PlanCreate
) -> MaintenancePlan:
    if not data.unit_id and not data.building_id:
        raise HTTPException(status_code=422, detail="unit_id_or_building_id_required")
    plan = MaintenancePlan(
        company_id=company_id,
        unit_id=data.unit_id,
        building_id=data.building_id,
        title=data.title,
        category=data.category,
        priority=data.priority,
        cron_expression=data.cron_expression,
        active=True,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


async def update_plan(
    db: AsyncSession, company_id: uuid.UUID, plan_id: uuid.UUID, data: PlanUpdate
) -> MaintenancePlan | None:
    result = await db.execute(
        select(MaintenancePlan).where(
            MaintenancePlan.id == plan_id,
            MaintenancePlan.company_id == company_id,
            MaintenancePlan.deleted_at.is_(None),
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    await db.commit()
    await db.refresh(plan)
    return plan


# ── Phase 2 : Calendrier ──────────────────────────────────────────────────

async def get_calendar(
    db: AsyncSession,
    company_id: uuid.UUID,
    horizon_days: int = 30,
) -> list[dict]:
    """Retourne les tickets avec SLA à venir + plans préventifs dans l'horizon."""

    horizon = datetime.now(UTC) + timedelta(days=horizon_days)
    entries: list[dict] = []

    # Tickets avec SLA dans l'horizon (non terminaux).
    result = await db.execute(
        select(MaintenanceTicket).where(
            MaintenanceTicket.company_id == company_id,
            MaintenanceTicket.deleted_at.is_(None),
            MaintenanceTicket.sla_due_at.isnot(None),
            MaintenanceTicket.sla_due_at <= horizon,
            MaintenanceTicket.status.notin_(["closed", "cancelled"]),
        ).order_by(MaintenanceTicket.sla_due_at)
    )
    for t in result.scalars().all():
        entries.append({
            "kind": "sla",
            "ticket_id": t.id,
            "plan_id": None,
            "reference": t.reference,
            "title": t.title,
            "priority": t.priority,
            "due_at": t.sla_due_at,
            "is_breached": is_sla_breached(t),
        })

    # Plans préventifs actifs avec next_due_at dans l'horizon.
    result_p = await db.execute(
        select(MaintenancePlan).where(
            MaintenancePlan.company_id == company_id,
            MaintenancePlan.deleted_at.is_(None),
            MaintenancePlan.active.is_(True),
            MaintenancePlan.next_due_at.isnot(None),
            MaintenancePlan.next_due_at <= horizon,
        ).order_by(MaintenancePlan.next_due_at)
    )
    for p in result_p.scalars().all():
        entries.append({
            "kind": "preventive",
            "ticket_id": None,
            "plan_id": p.id,
            "reference": None,
            "title": p.title,
            "priority": p.priority,
            "due_at": p.next_due_at,
            "is_breached": False,
        })

    entries.sort(key=lambda e: e["due_at"])
    return entries
