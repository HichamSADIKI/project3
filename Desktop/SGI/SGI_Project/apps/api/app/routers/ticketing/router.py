"""Router FastAPI — Ticketing SLA.

Ph2 : API REST (liste, détail + timeline, create, assign, transition,
commentaire) bâtie sur le service Ph0-1. Tout est filtré par `company_id`
(Loi 1) et un simple agent ne voit/touche que SES tickets assignés (anti-BOLA :
404, jamais 403, pour ne pas révéler l'existence d'un ticket d'autrui).
"""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.user import User
from app.routers.ticketing import service
from app.routers.ticketing.models import ServiceTicket
from app.routers.ticketing.schemas import (
    AssignBody,
    CommentCreate,
    EventItemOut,
    EventOut,
    TicketCreate,
    TicketDetail,
    TicketDetailOut,
    TicketItemOut,
    TicketListOut,
    TicketOut,
    TransitionBody,
)

router = APIRouter(prefix="/tickets", tags=["ticketing"])

_WRITE_ROLES = ("admin", "manager", "agent")


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


def _get_user_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "user_id", None)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_context_missing")
    return uuid.UUID(raw)


def _get_role(request: Request) -> str | None:
    return getattr(request.state, "role", None)


def _require_roles(*allowed_roles: str) -> Callable[[Request], Awaitable[None]]:
    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions"
            )

    return _check


async def _load_visible_ticket(
    db: AsyncSession, request: Request, company_id: uuid.UUID, ticket_id: uuid.UUID
) -> ServiceTicket:
    """Charge un ticket du tenant ou lève 404. Anti-BOLA : un simple agent ne
    peut accéder qu'aux tickets qui LUI sont assignés (la cible reste invisible
    — 404, jamais 403, pour ne pas révéler son existence)."""
    ticket = await service.get_ticket(db, company_id, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ticket_not_found")
    if _get_role(request) == "agent" and ticket.assigned_agent_id != _get_user_id(request):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ticket_not_found")
    return ticket


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "ticketing", "status": "ok"}


# ── Tickets ──────────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=TicketListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_tickets_endpoint(
    request: Request,
    status_: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    assigned_agent_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> TicketListOut:
    company_id = _get_company_id(request)
    # Anti-BOLA horizontal : un simple agent ne voit que SES tickets assignés ;
    # le filtre libre par agent est réservé aux superviseurs. Le filtre
    # company_id reste appliqué dans tous les cas (Loi 1).
    if _get_role(request) == "agent":
        assigned_agent_id = _get_user_id(request)
    tickets, total = await service.list_tickets(
        db,
        company_id,
        page=page,
        limit=limit,
        status=status_,
        priority=priority,
        assigned_agent_id=assigned_agent_id,
    )
    return TicketListOut(
        data=[TicketOut.model_validate(t) for t in tickets],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.get(
    "/{ticket_id}",
    response_model=TicketDetailOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_ticket_endpoint(
    ticket_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TicketDetailOut:
    company_id = _get_company_id(request)
    ticket = await _load_visible_ticket(db, request, company_id, ticket_id)
    events = await service.list_events(db, company_id, ticket.id)

    detail = TicketDetail.model_validate(ticket)
    detail.events = [EventOut.model_validate(e) for e in events]
    return TicketDetailOut(data=detail)


@router.post(
    "",
    response_model=TicketItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def create_ticket_endpoint(
    body: TicketCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TicketItemOut:
    company_id = _get_company_id(request)
    ticket = await service.create_ticket(
        db,
        company_id,
        subject=body.subject,
        description=body.description,
        category=body.category,
        priority=body.priority,
        requester_client_id=body.requester_client_id,
        actor_user_id=_get_user_id(request),
    )
    return TicketItemOut(data=TicketOut.model_validate(ticket))


@router.post(
    "/{ticket_id}/assign",
    response_model=TicketItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def assign_ticket_endpoint(
    ticket_id: uuid.UUID,
    body: AssignBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TicketItemOut:
    """Attribue le ticket à un agent.

    - `agent_user_id` omis → auto-attribution à l'appelant (« M'assigner »),
      autorisée à tout rôle write (dont agent).
    - Attribuer à QUELQU'UN D'AUTRE est réservé aux superviseurs ; un simple
      agent ne peut que s'auto-attribuer (403 sinon).
    - L'agent cible doit appartenir au même tenant (Loi 1, 400 sinon).
    """
    company_id = _get_company_id(request)
    requester_id = _get_user_id(request)
    agent_id = body.agent_user_id or requester_id
    if _get_role(request) == "agent" and agent_id != requester_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="agents_can_only_self_assign"
        )
    # 404 d'abord si le ticket n'appartient pas au tenant (Loi 1).
    if await service.get_ticket(db, company_id, ticket_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ticket_not_found")
    # L'agent cible doit exister dans CE tenant (anti cross-tenant, Loi 1).
    target = (
        await db.execute(select(User).where(User.id == agent_id, User.company_id == company_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="agent_not_in_company")
    ticket = await service.assign_ticket(
        db, company_id, ticket_id, agent_id, actor_user_id=requester_id
    )
    if ticket is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ticket_not_found")
    return TicketItemOut(data=TicketOut.model_validate(ticket))


@router.post(
    "/{ticket_id}/transition",
    response_model=TicketItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def transition_ticket_endpoint(
    ticket_id: uuid.UUID,
    body: TransitionBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TicketItemOut:
    company_id = _get_company_id(request)
    await _load_visible_ticket(db, request, company_id, ticket_id)
    try:
        ticket = await service.transition_ticket(
            db, company_id, ticket_id, body.status, actor_user_id=_get_user_id(request)
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if ticket is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ticket_not_found")
    return TicketItemOut(data=TicketOut.model_validate(ticket))


@router.post(
    "/{ticket_id}/comments",
    response_model=EventItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def add_comment_endpoint(
    ticket_id: uuid.UUID,
    body: CommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> EventItemOut:
    company_id = _get_company_id(request)
    await _load_visible_ticket(db, request, company_id, ticket_id)
    event = await service.add_comment(
        db, company_id, ticket_id, body.body, actor_user_id=_get_user_id(request)
    )
    if event is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ticket_not_found")
    return EventItemOut(data=EventOut.model_validate(event))
