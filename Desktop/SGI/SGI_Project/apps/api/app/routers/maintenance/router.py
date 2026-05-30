"""Router Maintenance — /api/v1/maintenance."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles

from .schemas import (
    CalendarOut,
    InvoiceCreate,
    InvoiceOut,
    PlanCreate,
    PlanOut,
    PlanUpdate,
    QuoteCreate,
    QuoteOut,
    TicketAssign,
    TicketCreate,
    TicketDetailOut,
    TicketListOut,
    TicketStatusUpdate,
    TicketUpdate,
)
from .service import (
    approve_quote,
    assign_ticket,
    create_invoice,
    create_plan,
    create_quote,
    create_ticket,
    get_calendar,
    get_ticket,
    list_invoices,
    list_plans,
    list_quotes,
    list_tickets,
    reject_quote,
    soft_delete_ticket,
    update_plan,
    update_ticket,
    update_ticket_status,
)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _user_id(request: Request) -> uuid.UUID:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return uuid.UUID(uid)


# ── Liste ─────────────────────────────────────────────────────────────────

@router.get("/tickets", response_model=TicketListOut)
async def list_tickets_endpoint(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    category: str | None = Query(None),
    unit_id: uuid.UUID | None = Query(None),
    assignee_id: uuid.UUID | None = Query(None),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> TicketListOut:
    company_id = await get_company_id(db)
    items, total = await list_tickets(
        db, company_id,
        page=page, limit=limit,
        status=status, priority=priority, category=category,
        unit_id=unit_id, assignee_id=assignee_id, q=q,
    )
    pages = (total + limit - 1) // limit
    return TicketListOut(
        data=items,
        meta={"total": total, "page": page, "limit": limit, "pages": pages},
    )


# ── Création ──────────────────────────────────────────────────────────────

@router.post(
    "/tickets",
    response_model=TicketDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket_endpoint(
    body: TicketCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> TicketDetailOut:
    company_id = await get_company_id(db)
    user_id = _user_id(request)
    ticket = await create_ticket(db, company_id, body, user_id)
    return TicketDetailOut(data=ticket)


# ── Détail ────────────────────────────────────────────────────────────────

@router.get("/tickets/{ticket_id}", response_model=TicketDetailOut)
async def get_ticket_endpoint(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> TicketDetailOut:
    company_id = await get_company_id(db)
    ticket = await get_ticket(db, company_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="ticket_not_found")
    return TicketDetailOut(data=ticket)


# ── Mise à jour partielle ─────────────────────────────────────────────────

@router.patch("/tickets/{ticket_id}", response_model=TicketDetailOut)
async def update_ticket_endpoint(
    ticket_id: uuid.UUID,
    body: TicketUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> TicketDetailOut:
    company_id = await get_company_id(db)
    ticket = await update_ticket(db, company_id, ticket_id, body)
    if not ticket:
        raise HTTPException(status_code=404, detail="ticket_not_found")
    return TicketDetailOut(data=ticket)


# ── Assignation ───────────────────────────────────────────────────────────

@router.post("/tickets/{ticket_id}/assign", response_model=TicketDetailOut)
async def assign_ticket_endpoint(
    ticket_id: uuid.UUID,
    body: TicketAssign,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> TicketDetailOut:
    company_id = await get_company_id(db)
    user_id = _user_id(request)
    ticket = await assign_ticket(db, company_id, ticket_id, body, user_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="ticket_not_found")
    return TicketDetailOut(data=ticket)


# ── Transition de statut ──────────────────────────────────────────────────

@router.post("/tickets/{ticket_id}/status", response_model=TicketDetailOut)
async def update_status_endpoint(
    ticket_id: uuid.UUID,
    body: TicketStatusUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> TicketDetailOut:
    company_id = await get_company_id(db)
    ticket = await update_ticket_status(db, company_id, ticket_id, body)
    if not ticket:
        raise HTTPException(status_code=404, detail="ticket_not_found")
    return TicketDetailOut(data=ticket)


# ── Soft delete ───────────────────────────────────────────────────────────

@router.delete(
    "/tickets/{ticket_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_ticket_endpoint(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> None:
    company_id = await get_company_id(db)
    ok = await soft_delete_ticket(db, company_id, ticket_id)
    if not ok:
        raise HTTPException(status_code=404, detail="ticket_not_found")


# ── Phase 2 : Devis ───────────────────────────────────────────────────────

@router.get("/tickets/{ticket_id}/quotes", response_model=list[QuoteOut])
async def list_quotes_endpoint(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> list[QuoteOut]:
    company_id = await get_company_id(db)
    return [QuoteOut.model_validate(q) for q in await list_quotes(db, company_id, ticket_id)]


@router.post("/tickets/{ticket_id}/quotes", response_model=QuoteOut,
             status_code=status.HTTP_201_CREATED)
async def create_quote_endpoint(
    ticket_id: uuid.UUID,
    body: QuoteCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> QuoteOut:
    company_id = await get_company_id(db)
    quote = await create_quote(db, company_id, ticket_id, body)
    if not quote:
        raise HTTPException(status_code=404, detail="ticket_not_found")
    return QuoteOut.model_validate(quote)


@router.post("/quotes/{quote_id}/approve", response_model=QuoteOut)
async def approve_quote_endpoint(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> QuoteOut:
    company_id = await get_company_id(db)
    quote = await approve_quote(db, company_id, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="quote_not_found")
    return QuoteOut.model_validate(quote)


@router.post("/quotes/{quote_id}/reject", response_model=QuoteOut)
async def reject_quote_endpoint(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> QuoteOut:
    company_id = await get_company_id(db)
    quote = await reject_quote(db, company_id, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="quote_not_found")
    return QuoteOut.model_validate(quote)


# ── Phase 2 : Factures ────────────────────────────────────────────────────

@router.get("/tickets/{ticket_id}/invoices", response_model=list[InvoiceOut])
async def list_invoices_endpoint(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> list[InvoiceOut]:
    company_id = await get_company_id(db)
    return [InvoiceOut.model_validate(i) for i in await list_invoices(db, company_id, ticket_id)]


@router.post("/tickets/{ticket_id}/invoices", response_model=InvoiceOut,
             status_code=status.HTTP_201_CREATED)
async def create_invoice_endpoint(
    ticket_id: uuid.UUID,
    body: InvoiceCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> InvoiceOut:
    company_id = await get_company_id(db)
    invoice = await create_invoice(db, company_id, ticket_id, body)
    if not invoice:
        raise HTTPException(status_code=404, detail="ticket_not_found")
    return InvoiceOut.model_validate(invoice)


# ── Phase 2 : Plans préventifs ────────────────────────────────────────────

@router.get("/plans", response_model=list[PlanOut])
async def list_plans_endpoint(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> list[PlanOut]:
    company_id = await get_company_id(db)
    return [PlanOut.model_validate(p) for p in await list_plans(db, company_id, active_only)]


@router.post("/plans", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan_endpoint(
    body: PlanCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> PlanOut:
    company_id = await get_company_id(db)
    plan = await create_plan(db, company_id, body)
    return PlanOut.model_validate(plan)


@router.patch("/plans/{plan_id}", response_model=PlanOut)
async def update_plan_endpoint(
    plan_id: uuid.UUID,
    body: PlanUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> PlanOut:
    company_id = await get_company_id(db)
    plan = await update_plan(db, company_id, plan_id, body)
    if not plan:
        raise HTTPException(status_code=404, detail="plan_not_found")
    return PlanOut.model_validate(plan)


# ── Phase 2 : Calendrier ──────────────────────────────────────────────────

@router.get("/calendar", response_model=CalendarOut)
async def get_calendar_endpoint(
    horizon_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> CalendarOut:
    company_id = await get_company_id(db)
    entries = await get_calendar(db, company_id, horizon_days)
    return CalendarOut(data=entries, meta={"horizon_days": horizon_days, "count": len(entries)})
