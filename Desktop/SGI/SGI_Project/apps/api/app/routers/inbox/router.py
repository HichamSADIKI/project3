"""Router FastAPI — Omnichannel Inbox.

Socle Ph0-1 : health + dépendances partagées. Ph2 : API REST (conversations,
messages sortants, assign, statut, notes, tags) bâtie sur le service Ph0-1
(`get_or_create_conversation`, `add_message`, `set_status`, `assign_conversation`,
`list_conversations`, `get_conversation`). Tout est filtré par `company_id` (Loi 1)
et un simple agent ne voit que SES conversations assignées (anti-BOLA).
"""

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, status
from sqlalchemy import select
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_jwt
from app.core.database import get_db
from app.core.deps import get_db_session
from app.models.user import User
from app.routers.inbox import service
from app.routers.inbox.models import (
    InboxConversation,
    InboxConversationTag,
    InboxMessage,
    InboxNote,
    InboxTag,
)
from app.routers.inbox.schemas import (
    AssignBody,
    ConversationDetail,
    ConversationDetailOut,
    ConversationItemOut,
    ConversationListOut,
    ConversationOut,
    MessageCreate,
    MessageItemOut,
    MessageOut,
    NoteCreate,
    NoteItemOut,
    NoteOut,
    StatusBody,
    TagAttach,
    TagCreate,
    TagItemOut,
    TagListOut,
    TagOut,
)
from app.routers.inbox.ws import inbox_ws_handler, publish_inbox_event

router = APIRouter(prefix="/inbox", tags=["inbox"])

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


async def _load_visible_conversation(
    db: AsyncSession, request: Request, company_id: uuid.UUID, conv_id: uuid.UUID
) -> InboxConversation:
    """Charge une conversation du tenant ou lève 404. Anti-BOLA : un simple agent
    ne peut accéder qu'aux conversations qui LUI sont assignées (la cible reste
    invisible — 404, jamais 403, pour ne pas révéler son existence)."""
    conv = await service.get_conversation(db, company_id, conv_id)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conversation_not_found")
    if _get_role(request) == "agent" and conv.assigned_agent_id != _get_user_id(request):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conversation_not_found")
    return conv


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "inbox", "status": "ok"}


# ── Conversations ───────────────────────────────────────────────────────────


@router.get(
    "/conversations",
    response_model=ConversationListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_conversations_endpoint(
    request: Request,
    channel: str | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    assigned_agent_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> ConversationListOut:
    company_id = _get_company_id(request)
    # Anti-BOLA horizontal : un simple agent ne voit que SES conversations
    # assignées ; le filtre libre par agent est réservé aux superviseurs. Le
    # filtre company_id reste appliqué dans tous les cas (Loi 1).
    if _get_role(request) == "agent":
        assigned_agent_id = _get_user_id(request)
    convs, total = await service.list_conversations(
        db, company_id, page, limit, channel, status_, assigned_agent_id
    )
    return ConversationListOut(
        data=[ConversationOut.model_validate(c) for c in convs],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.get(
    "/conversations/{conv_id}",
    response_model=ConversationDetailOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_conversation_endpoint(
    conv_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ConversationDetailOut:
    company_id = _get_company_id(request)
    conv = await _load_visible_conversation(db, request, company_id, conv_id)

    messages = (
        (
            await db.execute(
                select(InboxMessage)
                .where(
                    InboxMessage.company_id == company_id,
                    InboxMessage.conversation_id == conv.id,
                )
                .order_by(InboxMessage.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    notes = (
        (
            await db.execute(
                select(InboxNote)
                .where(
                    InboxNote.company_id == company_id,
                    InboxNote.conversation_id == conv.id,
                )
                .order_by(InboxNote.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    tags = (
        (
            await db.execute(
                select(InboxTag)
                .join(InboxConversationTag, InboxConversationTag.tag_id == InboxTag.id)
                .where(
                    InboxTag.company_id == company_id,
                    InboxConversationTag.conversation_id == conv.id,
                )
                .order_by(InboxTag.name.asc())
            )
        )
        .scalars()
        .all()
    )

    detail = ConversationDetail.model_validate(conv)
    detail.messages = [MessageOut.model_validate(m) for m in messages]
    detail.notes = [NoteOut.model_validate(n) for n in notes]
    detail.tags = [TagOut.model_validate(t) for t in tags]
    return ConversationDetailOut(data=detail)


@router.post(
    "/conversations/{conv_id}/messages",
    response_model=MessageItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def post_message_endpoint(
    conv_id: uuid.UUID,
    body: MessageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MessageItemOut:
    """Réponse sortante d'un agent (direction=outbound, sender_user_id renseigné)."""
    company_id = _get_company_id(request)
    conv = await _load_visible_conversation(db, request, company_id, conv_id)
    msg, _ = await service.add_message(
        db,
        company_id,
        conv,
        direction="outbound",
        body=body.body,
        sender_user_id=_get_user_id(request),
    )
    await publish_inbox_event(
        company_id,
        {
            "type": "message.created",
            "data": {
                "conversation_id": str(conv.id),
                "message_id": str(msg.id),
                "channel": conv.channel,
                "direction": "outbound",
                "body": body.body,
            },
        },
        target_agent_id=conv.assigned_agent_id,
    )
    return MessageItemOut(data=MessageOut.model_validate(msg))


@router.post(
    "/conversations/{conv_id}/assign",
    response_model=ConversationItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def assign_conversation_endpoint(
    conv_id: uuid.UUID,
    body: AssignBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ConversationItemOut:
    """Attribue la conversation à un agent.

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
    # 404 d'abord si le fil n'appartient pas au tenant (Loi 1).
    if await service.get_conversation(db, company_id, conv_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conversation_not_found")
    # L'agent cible doit exister dans CE tenant (anti cross-tenant, Loi 1).
    target = (
        await db.execute(select(User).where(User.id == agent_id, User.company_id == company_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="agent_not_in_company")
    conv = await service.assign_conversation(db, company_id, conv_id, agent_id)
    if conv is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conversation_not_found")
    await publish_inbox_event(
        company_id,
        {
            "type": "conversation.assigned",
            "data": {
                "conversation_id": str(conv.id),
                "assigned_agent_id": str(agent_id),
                "status": conv.status,
            },
        },
        target_agent_id=agent_id,
    )
    return ConversationItemOut(data=ConversationOut.model_validate(conv))


@router.post(
    "/conversations/{conv_id}/status",
    response_model=ConversationItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def set_status_endpoint(
    conv_id: uuid.UUID,
    body: StatusBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ConversationItemOut:
    company_id = _get_company_id(request)
    await _load_visible_conversation(db, request, company_id, conv_id)
    try:
        conv = await service.set_status(db, company_id, conv_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if conv is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conversation_not_found")
    await publish_inbox_event(
        company_id,
        {
            "type": "conversation.status",
            "data": {"conversation_id": str(conv.id), "status": conv.status},
        },
        target_agent_id=conv.assigned_agent_id,
    )
    return ConversationItemOut(data=ConversationOut.model_validate(conv))


@router.post(
    "/conversations/{conv_id}/notes",
    response_model=NoteItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def add_note_endpoint(
    conv_id: uuid.UUID,
    body: NoteCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> NoteItemOut:
    """Note interne d'agent (jamais visible du client)."""
    company_id = _get_company_id(request)
    conv = await _load_visible_conversation(db, request, company_id, conv_id)
    note = InboxNote(
        company_id=company_id,
        conversation_id=conv.id,
        agent_user_id=_get_user_id(request),
        body=body.body,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteItemOut(data=NoteOut.model_validate(note))


# ── Tags ─────────────────────────────────────────────────────────────────


@router.get(
    "/tags",
    response_model=TagListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_tags_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TagListOut:
    company_id = _get_company_id(request)
    tags = (
        (
            await db.execute(
                select(InboxTag)
                .where(InboxTag.company_id == company_id)
                .order_by(InboxTag.name.asc())
            )
        )
        .scalars()
        .all()
    )
    return TagListOut(data=[TagOut.model_validate(t) for t in tags])


@router.post(
    "/tags",
    response_model=TagItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def create_tag_endpoint(
    body: TagCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TagItemOut:
    company_id = _get_company_id(request)
    tag = InboxTag(company_id=company_id, name=body.name, color=body.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagItemOut(data=TagOut.model_validate(tag))


@router.post(
    "/conversations/{conv_id}/tags",
    response_model=ConversationItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def attach_tag_endpoint(
    conv_id: uuid.UUID,
    body: TagAttach,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ConversationItemOut:
    """Attache un tag (du même tenant) à une conversation. Idempotent."""
    company_id = _get_company_id(request)
    conv = await _load_visible_conversation(db, request, company_id, conv_id)

    # Tag par id (existant) OU par nom (créé à la volée si absent — create-or-attach).
    if body.tag_id is not None:
        tag = (
            await db.execute(
                select(InboxTag).where(
                    InboxTag.id == body.tag_id,
                    InboxTag.company_id == company_id,
                )
            )
        ).scalar_one_or_none()
        if tag is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="tag_not_found")
    elif body.name:
        tag = (
            await db.execute(
                select(InboxTag).where(
                    InboxTag.name == body.name,
                    InboxTag.company_id == company_id,
                )
            )
        ).scalar_one_or_none()
        if tag is None:
            tag = InboxTag(company_id=company_id, name=body.name)
            db.add(tag)
            await db.flush()
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tag_id_or_name_required"
        )

    existing = (
        await db.execute(
            select(InboxConversationTag).where(
                InboxConversationTag.conversation_id == conv.id,
                InboxConversationTag.tag_id == tag.id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            InboxConversationTag(
                company_id=company_id,
                conversation_id=conv.id,
                tag_id=tag.id,
                created_at=datetime.now(UTC),
            )
        )
        await db.commit()
    return ConversationItemOut(data=ConversationOut.model_validate(conv))


# ── WebSocket temps réel (Ph4) ─────────────────────────────────────────────


@router.websocket("/ws")
async def inbox_ws_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT d'authentification"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """WS /api/v1/inbox/ws?token=<jwt>

    Auth JWT en query param (le middleware tenant ne tourne pas sur le scope WS).
    Superviseur (admin/manager) → flux TENANT (toute la file) ; agent → flux
    dédié à son périmètre. Le contexte RLS est posé manuellement.
    """
    try:
        payload = decode_jwt(token)
        company_id = payload.get("company_id")
        user_id = payload.get("sub")
        if not company_id or not user_id or payload.get("mfa_pending"):
            await websocket.close(code=4401)
            return
        company_uuid = uuid.UUID(company_id)
        user_uuid = uuid.UUID(user_id)
    except Exception:  # noqa: BLE001
        await websocket.close(code=4401)
        return

    # GUC posé en portée SESSION (is_local=false) puis commit, comme
    # get_db_session : la connexion get_db étant épinglée, le contexte RLS
    # survit même sous le rôle restreint sgi_app.
    await db.execute(
        sql_text("SELECT set_config('app.current_company_id', :cid, false)"),
        {"cid": str(company_uuid)},
    )
    await db.commit()

    is_supervisor = payload.get("role") in {"admin", "manager"}
    await inbox_ws_handler(
        websocket, str(company_uuid), str(user_uuid), is_supervisor=is_supervisor
    )
