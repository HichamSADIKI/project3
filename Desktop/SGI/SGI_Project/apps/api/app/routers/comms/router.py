"""Router Communication — /api/v1/comms (REST + WebSocket)."""
import uuid

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException,
    Query, Request, UploadFile, WebSocket, WebSocketDisconnect, status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import text as sql_text

from app.core.database import get_db
from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.core.auth import decode_jwt

from .schemas import (
    ConversationCreate,
    ConversationDetailOut,
    ConversationListOut,
    ConversationOut,
    MessageCreate,
    MessageListOut,
    MessageOut,
    ParticipantAdd,
    ParticipantOut,
)
from .service import (
    add_participant,
    create_conversation,
    get_conversation,
    get_participants,
    list_conversations,
    list_messages,
    mark_read,
    send_message,
)

router = APIRouter(prefix="/comms", tags=["communication"])


def _user_id(request: Request) -> uuid.UUID:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return uuid.UUID(uid)


# ── Conversations ─────────────────────────────────────────────────────────

@router.post(
    "/conversations",
    response_model=ConversationDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_conv(
    body: ConversationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> ConversationDetailOut:
    company_id = await get_company_id(db)
    user_id = _user_id(request)
    conv = await create_conversation(db, company_id, body, user_id)
    parts = await get_participants(db, company_id, conv.id)
    out = ConversationOut.model_validate(conv)
    out.participants = [ParticipantOut.model_validate(p) for p in parts]
    return ConversationDetailOut(data=out)


@router.get("/conversations", response_model=ConversationListOut)
async def list_convs(
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    request: Request = ...,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> ConversationListOut:
    company_id = await get_company_id(db)
    user_id = _user_id(request)
    items, total = await list_conversations(db, company_id, user_id, type, page, limit)
    pages = (total + limit - 1) // limit

    data = []
    for conv in items:
        parts = await get_participants(db, company_id, conv.id)
        out = ConversationOut.model_validate(conv)
        out.participants = [ParticipantOut.model_validate(p) for p in parts]
        data.append(out)

    return ConversationListOut(
        data=data,
        meta={"total": total, "page": page, "limit": limit, "pages": pages},
    )


@router.get("/conversations/{conv_id}", response_model=ConversationDetailOut)
async def get_conv(
    conv_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> ConversationDetailOut:
    company_id = await get_company_id(db)
    user_id = _user_id(request)
    conv = await get_conversation(db, company_id, conv_id, user_id)
    if not conv:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    parts = await get_participants(db, company_id, conv_id)
    out = ConversationOut.model_validate(conv)
    out.participants = [ParticipantOut.model_validate(p) for p in parts]
    return ConversationDetailOut(data=out)


# ── Participants ──────────────────────────────────────────────────────────

@router.post(
    "/conversations/{conv_id}/participants",
    response_model=ParticipantOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_part(
    conv_id: uuid.UUID,
    body: ParticipantAdd,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> ParticipantOut:
    company_id = await get_company_id(db)
    part = await add_participant(db, company_id, conv_id, body)
    return ParticipantOut.model_validate(part)


# ── Marquer comme lu ──────────────────────────────────────────────────────

@router.post(
    "/conversations/{conv_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def read_conv(
    conv_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> None:
    company_id = await get_company_id(db)
    user_id = _user_id(request)
    ok = await mark_read(db, company_id, conv_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not_a_participant")


# ── Messages ──────────────────────────────────────────────────────────────

@router.post(
    "/conversations/{conv_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_msg(
    conv_id: uuid.UUID,
    body: MessageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> MessageOut:
    company_id = await get_company_id(db)
    user_id = _user_id(request)
    msg = await send_message(db, company_id, conv_id, user_id, body)
    return MessageOut.model_validate(msg)


@router.get("/conversations/{conv_id}/messages", response_model=MessageListOut)
async def list_msgs(
    conv_id: uuid.UUID,
    request: Request,
    before_id: uuid.UUID | None = Query(None, description="Curseur de pagination"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> MessageListOut:
    company_id = await get_company_id(db)
    user_id = _user_id(request)
    msgs, total = await list_messages(db, company_id, conv_id, user_id, before_id, limit)
    return MessageListOut(
        data=[MessageOut.model_validate(m) for m in msgs],
        meta={"total": total, "limit": limit, "has_more": total > limit},
    )


# ── Phase 4 : Upload voice note ───────────────────────────────────────────

@router.post(
    "/conversations/{conv_id}/voice",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_voice(
    conv_id: uuid.UUID,
    request: Request,
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> MessageOut:
    """Upload une voice note → MinIO → message kind=voice → transcription Celery."""
    from app.core.storage import StorageError, is_configured, upload_bytes
    from app.core.whisper import ALLOWED_MIME_PREFIXES, MAX_AUDIO_BYTES

    company_id = await get_company_id(db)
    user_id = _user_id(request)

    content_type = audio.content_type or "audio/webm"
    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=422, detail="unsupported_audio_mime")

    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=422, detail="audio_too_large")
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="empty_audio")

    # Upload MinIO.
    attachment_key: str | None = None
    if is_configured():
        try:
            from app.core.storage import extension_for_mime
            ext = extension_for_mime(content_type) or "webm"
            key = f"voice/{company_id}/{conv_id}/{uuid.uuid4()}.{ext}"
            attachment_key = upload_bytes(key, audio_bytes, content_type)
        except StorageError as exc:
            raise HTTPException(status_code=503, detail=f"storage_error: {exc}") from exc

    # Crée le message kind=voice.
    from .schemas import MessageCreate
    body_data = MessageCreate(body=None, kind="voice")
    # Patch direct pour attachment_key (non exposé dans le schéma).
    from app.models.conversation import ConversationMessage
    from .service import _check_participant
    from datetime import datetime, timezone
    if not await _check_participant(db, company_id, conv_id, user_id):
        raise HTTPException(status_code=403, detail="not_a_participant")

    msg = ConversationMessage(
        company_id=company_id,
        conversation_id=conv_id,
        sender_user_id=user_id,
        kind="voice",
        body=None,
        attachment_key=attachment_key,
        created_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Enqueue transcription Celery (best-effort, ne bloque pas la réponse).
    if attachment_key:
        from app.tasks.comms import transcribe_voice_note
        transcribe_voice_note.delay(str(msg.id), str(company_id))

    # Publie l'event WS.
    from .ws import publish_event
    from .schemas import MessageOut as MOut
    await publish_event(company_id, conv_id, {
        "type": "message.created",
        "data": MOut.model_validate(msg).model_dump(mode="json"),
    })

    return MessageOut.model_validate(msg)


# ── Phase 4 : Résumé IA ───────────────────────────────────────────────────

@router.post("/conversations/{conv_id}/summarize")
async def summarize_conv(
    conv_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> dict:
    """Génère un résumé Gemini de la conversation (30 derniers messages)."""
    company_id = await get_company_id(db)
    user_id = _user_id(request)

    msgs, _ = await list_messages(db, company_id, conv_id, user_id, limit=30)
    if not msgs:
        return {"summary": ""}

    text = "\n".join(
        f"[{m.sender_user_id}] {m.body or '[voice]'}"
        for m in msgs if m.body or m.transcript
    )
    try:
        from app.core.gemini import parse_client_need
        # Réutilise le moteur Gemini pour résumer (prompt libre via summary).
        result = await parse_client_need(
            f"Résume cette conversation en 2-3 phrases :\n{text[:3000]}",
            locale="fr",
        )
        return {"summary": result.get("summary", text[:300]), "engine": result.get("engine")}
    except Exception:  # noqa: BLE001
        return {"summary": text[:300], "engine": "fallback"}


# ── Phase 4 : Traduction inline ───────────────────────────────────────────

@router.get("/messages/{message_id}/translate")
async def translate_message(
    message_id: uuid.UUID,
    target_locale: str = Query("fr", pattern="^(ar|en|fr)$"),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> dict:
    """Traduit le corps d'un message via Gemini translate."""
    from sqlalchemy import select
    from app.models.conversation import ConversationMessage

    company_id = await get_company_id(db)
    result = await db.execute(
        select(ConversationMessage).where(
            ConversationMessage.id == message_id,
            ConversationMessage.company_id == company_id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="message_not_found")

    text = msg.body or msg.transcript or ""
    if not text:
        return {"translated": "", "locale": target_locale}

    try:
        from app.core.gemini import parse_client_need
        result_g = await parse_client_need(
            f"Traduis ce texte en {target_locale} :\n{text[:2000]}",
            locale=target_locale,
        )
        return {"translated": result_g.get("summary", text), "locale": target_locale}
    except Exception:  # noqa: BLE001
        return {"translated": text, "locale": target_locale}


# ── Phase 4 : WebSocket ───────────────────────────────────────────────────

@router.websocket("/ws/conversations/{conv_id}")
async def ws_endpoint(
    websocket: WebSocket,
    conv_id: str,
    token: str = Query(..., description="JWT d'authentification"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    WS /api/v1/comms/ws/conversations/{conv_id}?token=<jwt>

    Auth : JWT passé en query param (les headers WS sont limités côté browser).
    Le company_id et user_id sont extraits du token — aucune donnée sensible
    n'est exposée dans l'URL (le token est ephémère, TTL = session).
    """
    from .service import _check_participant
    from .ws import ws_handler

    try:
        payload = decode_jwt(token)
        company_id = payload.get("company_id")
        user_id = payload.get("sub")
        # Un tmp_token MFA (mfa_pending) ne donne pas accès au temps réel.
        if not company_id or not user_id or payload.get("mfa_pending"):
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    # Autorisation au niveau objet : l'utilisateur doit être participant de la
    # conversation (même garde que les routes REST). Empêche l'écoute des
    # conversations d'autrui dans le même tenant (BOLA temps réel).
    try:
        conv_uuid = uuid.UUID(conv_id)
        company_uuid = uuid.UUID(company_id)
        user_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        await websocket.close(code=4401)
        return

    # Le middleware tenant ne s'exécute pas sur le scope WebSocket : on pose
    # manuellement le contexte tenant (RLS) depuis le company_id du token,
    # sinon _check_participant serait filtré par la RLS et fermerait toujours.
    await db.execute(
        sql_text("SELECT set_config('app.current_company_id', :cid, true)"),
        {"cid": str(company_uuid)},
    )

    is_participant = await _check_participant(db, company_uuid, conv_uuid, user_uuid)
    if not is_participant:
        await websocket.close(code=4403)
        return

    await ws_handler(websocket, company_id, conv_id, user_id)
