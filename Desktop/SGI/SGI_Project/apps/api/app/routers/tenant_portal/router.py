"""Espace Locataire (Tenant) — /api/v1/tenant.

Le locataire se connecte avec role=client ; il est lié à une fiche `clients`
par email (étendue par un profil `tenant_profiles`). Ces endpoints exposent en
self-service ce que la spec « Portail Locataire » exige : **paiement · tickets ·
chat**.

Sécurité (Loi 1 + anti-BOLA horizontal) : chaque requête est scopée par le
`client_id` résolu depuis l'email du JWT — un locataire ne voit jamais les
paiements, tickets ou conversations d'un autre. Le chat réutilise `comms`,
scopé par le `user_id` participant.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import require_roles
from app.routers.client_portal.service import find_linked_client_id
from app.routers.comms import service as comms_service
from app.routers.comms.schemas import MessageCreate
from app.routers.payments import service as payments_service
from app.routers.payments.schemas import PayIn
from app.routers.ticketing import service as ticketing_service
from app.routers.ticketing.schemas import CommentCreate, TicketCreate

router = APIRouter(
    prefix="/tenant",
    tags=["tenant_portal"],
    dependencies=[Depends(require_roles("client", "admin", "manager"))],
)


def _ctx(request: Request) -> tuple[uuid.UUID, uuid.UUID, str]:
    uid = getattr(request.state, "user_id", None)
    cid = getattr(request.state, "company_id", None)
    email = getattr(request.state, "email", None)
    if not uid or not cid:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return uuid.UUID(uid), uuid.UUID(cid), email or ""


async def _tenant_client_id(
    db: AsyncSession, email: str, company_id: uuid.UUID
) -> uuid.UUID | None:
    return await find_linked_client_id(db, email, company_id)


# ── Sérialiseurs ──────────────────────────────────────────────────────────


def _payment_dict(r: Any) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "reference": r.reference,
        "payment_type": r.payment_type,
        "status": r.status,
        "amount_aed": str(r.amount_aed),
        "due_date": r.due_date.isoformat() if r.due_date else None,
        "paid_at": r.paid_at.isoformat() if r.paid_at else None,
        "description": r.description,
    }


def _ticket_dict(t: Any) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "reference": t.reference,
        "subject": t.subject,
        "description": t.description,
        "category": t.category,
        "priority": t.priority,
        "status": t.status,
        "sla_due_at": t.sla_due_at.isoformat() if t.sla_due_at else None,
        "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _event_dict(e: Any) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "event_type": e.event_type,
        "body": e.body,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _conversation_dict(c: Any) -> dict[str, Any]:
    return {
        "id": str(c.id),
        "type": c.type,
        "subject": c.subject,
        "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
    }


def _message_dict(m: Any) -> dict[str, Any]:
    return {
        "id": str(m.id),
        "sender_user_id": str(m.sender_user_id),
        "kind": m.kind,
        "body": m.body,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ── Dashboard ──────────────────────────────────────────────────────────────


@router.get("/dashboard")
async def tenant_dashboard(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> dict[str, Any]:
    uid, cid, email = _ctx(request)
    tenant_id = await _tenant_client_id(db, email, cid)
    if not tenant_id:
        return {
            "next_payment_aed": "0",
            "next_payment_due": None,
            "pending_payments": 0,
            "open_tickets": 0,
            "conversations": 0,
        }

    payments, _ = await payments_service.list_requests(
        db, cid, tenant_client_id=tenant_id, limit=100
    )
    pending = [p for p in payments if p.status in ("pending", "overdue")]
    # Prochaine échéance : la plus proche parmi les paiements dus.
    next_due = min(pending, key=lambda p: p.due_date, default=None)

    _tickets, tickets_total = await ticketing_service.list_tickets(
        db, cid, requester_client_id=tenant_id, limit=1
    )
    open_tickets, open_total = await ticketing_service.list_tickets(
        db, cid, requester_client_id=tenant_id, status="open", limit=1
    )
    _convs, convs_total = await comms_service.list_conversations(db, cid, uid, limit=1)

    return {
        "next_payment_aed": str(next_due.amount_aed) if next_due else "0",
        "next_payment_due": next_due.due_date.isoformat() if next_due else None,
        "pending_payments": len(pending),
        "tickets_count": tickets_total,
        "open_tickets": open_total,
        "conversations": convs_total,
    }


# ── Paiement ───────────────────────────────────────────────────────────────


@router.get("/payments")
async def tenant_payments(
    request: Request,
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    _uid, cid, email = _ctx(request)
    tenant_id = await _tenant_client_id(db, email, cid)
    if not tenant_id:
        return {"items": [], "total": 0}
    rows, total = await payments_service.list_requests(
        db, cid, status=status, tenant_client_id=tenant_id, page=page, limit=limit
    )
    return {"items": [_payment_dict(r) for r in rows], "total": total}


@router.post("/payments/{request_id}/pay")
async def tenant_pay(
    request_id: uuid.UUID,
    payload: PayIn,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    _uid, cid, email = _ctx(request)
    tenant_id = await _tenant_client_id(db, email, cid)
    # Anti-BOLA : le locataire ne peut payer qu'une demande qui le concerne.
    req = await payments_service.get_request(db, cid, request_id)
    if not tenant_id or req is None or req.tenant_client_id != tenant_id:
        raise HTTPException(status_code=404, detail="request_not_found")
    paid = await payments_service.pay_request(db, cid, request_id, payload)
    if paid is None:
        raise HTTPException(status_code=404, detail="request_not_found")
    return _payment_dict(paid)


# ── Tickets (service desk) ───────────────────────────────────────────────


@router.get("/tickets")
async def tenant_tickets(
    request: Request,
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    _uid, cid, email = _ctx(request)
    tenant_id = await _tenant_client_id(db, email, cid)
    if not tenant_id:
        return {"items": [], "total": 0}
    rows, total = await ticketing_service.list_tickets(
        db, cid, status=status, requester_client_id=tenant_id, page=page, limit=limit
    )
    return {"items": [_ticket_dict(t) for t in rows], "total": total}


@router.post("/tickets", status_code=201)
async def tenant_create_ticket(
    payload: TicketCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    uid, cid, email = _ctx(request)
    tenant_id = await _tenant_client_id(db, email, cid)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="not_a_tenant")
    ticket = await ticketing_service.create_ticket(
        db,
        cid,
        subject=payload.subject,
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
        requester_client_id=tenant_id,  # forcé : le locataire est le demandeur.
        actor_user_id=uid,
    )
    return _ticket_dict(ticket)


async def _owned_ticket(
    db: AsyncSession, cid: uuid.UUID, tenant_id: uuid.UUID | None, ticket_id: uuid.UUID
) -> Any:
    """Retourne le ticket si le locataire connecté en est le demandeur, sinon 404."""
    ticket = await ticketing_service.get_ticket(db, cid, ticket_id)
    if not tenant_id or ticket is None or ticket.requester_client_id != tenant_id:
        raise HTTPException(status_code=404, detail="ticket_not_found")
    return ticket


@router.get("/tickets/{ticket_id}")
async def tenant_ticket_detail(
    ticket_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    _uid, cid, email = _ctx(request)
    tenant_id = await _tenant_client_id(db, email, cid)
    ticket = await _owned_ticket(db, cid, tenant_id, ticket_id)
    events = await ticketing_service.list_events(db, cid, ticket_id)
    data = _ticket_dict(ticket)
    data["events"] = [_event_dict(e) for e in events]
    return data


@router.post("/tickets/{ticket_id}/comments", status_code=201)
async def tenant_ticket_comment(
    ticket_id: uuid.UUID,
    payload: CommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    uid, cid, email = _ctx(request)
    tenant_id = await _tenant_client_id(db, email, cid)
    await _owned_ticket(db, cid, tenant_id, ticket_id)
    event = await ticketing_service.add_comment(db, cid, ticket_id, payload.body, actor_user_id=uid)
    if event is None:
        raise HTTPException(status_code=404, detail="ticket_not_found")
    return _event_dict(event)


# ── Chat (réutilise comms, scopé par participant) ─────────────────────────


@router.get("/chat")
async def tenant_chat(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    uid, cid, _email = _ctx(request)
    rows, total = await comms_service.list_conversations(db, cid, uid, page=page, limit=limit)
    return {"items": [_conversation_dict(c) for c in rows], "total": total}


async def _participant_conv(
    db: AsyncSession, cid: uuid.UUID, uid: uuid.UUID, conv_id: uuid.UUID
) -> Any:
    """Retourne la conversation si le locataire en est participant, sinon 404.

    `comms.get_conversation` lève 403 si non-participant ; on convertit en 404
    pour ne pas divulguer l'existence d'une conversation tierce (anti-énumération).
    """
    try:
        conv = await comms_service.get_conversation(db, cid, conv_id, uid)
    except HTTPException:
        conv = None
    if conv is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return conv


@router.get("/chat/{conv_id}")
async def tenant_chat_detail(
    conv_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    uid, cid, _email = _ctx(request)
    conv = await _participant_conv(db, cid, uid, conv_id)
    messages, total = await comms_service.list_messages(db, cid, conv_id, uid)
    data = _conversation_dict(conv)
    data["messages"] = [_message_dict(m) for m in messages]
    data["total"] = total
    return data


@router.post("/chat/{conv_id}/messages", status_code=201)
async def tenant_chat_send(
    conv_id: uuid.UUID,
    payload: MessageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    uid, cid, _email = _ctx(request)
    await _participant_conv(db, cid, uid, conv_id)
    msg = await comms_service.send_message(db, cid, conv_id, uid, payload)
    return _message_dict(msg)
