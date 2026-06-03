"""Router FastAPI — Téléphonie (journal d'appels, agents, click-to-call, WS)."""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    WebSocket,
    status,
)
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_jwt
from app.core.database import get_db
from app.core.deps import get_db_session
from app.routers.telephony import service
from app.routers.telephony.ami import get_client
from app.routers.telephony.models import Call
from app.routers.telephony.recording import recording_router
from app.routers.telephony.schemas import (
    AgentStateDetailOut,
    AgentStateListOut,
    AgentStateOut,
    AgentStatusSet,
    CallCreate,
    CallDetailOut,
    CallListOut,
    CallNotesUpdate,
    CallOut,
    CallTransition,
    ClickToCall,
    PhoneLookupMatch,
    PhoneLookupOut,
)
from app.routers.telephony.ws import voice_ws_handler

router = APIRouter(prefix="/telephony", tags=["telephony"])


def _get_role(request: Request) -> str | None:
    return getattr(request.state, "role", None)


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


def _require_roles(*allowed_roles: str) -> Callable[[Request], Awaitable[None]]:
    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions"
            )

    return _check


def _call_out(call: Call) -> CallOut:
    """Sérialise un appel en masquant `recording_url` sans consentement (PDPL, H-1).

    Sans consentement enregistré, l'URL de l'enregistrement ne doit jamais
    fuiter (Federal Decree-Law No. 45 of 2021). On la masque à la source ; le
    téléchargement (recording.py) refuse de toute façon en 403.
    """
    out = CallOut.model_validate(call)
    if not out.recording_consent:
        out.recording_url = None
    return out


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "telephony", "status": "ok"}


# ── Journal d'appels ──────────────────────────────────────────────────────


@router.get(
    "/calls",
    response_model=CallListOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def list_calls_endpoint(
    request: Request,
    direction: str | None = Query(None, pattern="^(inbound|outbound|internal)$"),
    status_: str | None = Query(None, alias="status"),
    agent_user_id: uuid.UUID | None = Query(None),
    client_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> CallListOut:
    company_id = _get_company_id(request)
    # Anti-BOLA horizontal (M-2) : un simple agent ne peut consulter que SES
    # propres appels ; le filtre libre par agent_user_id est réservé aux
    # superviseurs (admin/manager). Reste borné au tenant dans tous les cas.
    if _get_role(request) == "agent":
        agent_user_id = _get_user_id(request)
    calls, total = await service.list_calls(
        db, company_id, page, limit, direction, status_, agent_user_id, client_id
    )
    return CallListOut(
        data=[_call_out(c) for c in calls],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/calls",
    response_model=CallDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def create_call_endpoint(
    body: CallCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CallDetailOut:
    company_id = _get_company_id(request)
    call = await service.create_call(
        db,
        company_id,
        direction=body.direction,
        from_number=body.from_number,
        to_number=body.to_number,
        client_id=body.client_id,
        agent_extension=body.agent_extension,
        queue=body.queue,
        recording_consent=body.recording_consent,
    )
    if body.notes:
        call.notes = body.notes
        await db.commit()
        await db.refresh(call)
    return CallDetailOut(data=_call_out(call))


@router.get(
    "/calls/{call_id}",
    response_model=CallDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def get_call_endpoint(
    call_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CallDetailOut:
    company_id = _get_company_id(request)
    call = await service.get_call(db, company_id, call_id)
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="call_not_found")
    return CallDetailOut(data=_call_out(call))


@router.post(
    "/calls/{call_id}/transition",
    response_model=CallDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def transition_call_endpoint(
    call_id: uuid.UUID,
    body: CallTransition,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CallDetailOut:
    company_id = _get_company_id(request)
    try:
        call = await service.transition_call(
            db, company_id, call_id, body.status, hangup_cause=body.hangup_cause
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="call_not_found")
    return CallDetailOut(data=_call_out(call))


@router.post(
    "/calls/{call_id}/notes",
    response_model=CallDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def set_call_notes_endpoint(
    call_id: uuid.UUID,
    body: CallNotesUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CallDetailOut:
    """Notes de wrap-up sur un appel existant (indépendant du statut).

    Distinct de la transition : l'AMI auto-transitionne l'appel vers `completed`
    au hangup, donc on ne peut pas surcharger /transition pour poser les notes.
    """
    company_id = _get_company_id(request)
    call = await service.get_call(db, company_id, call_id)
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="call_not_found")
    # Anti-BOLA horizontal : un agent ne peut écrire que sur SES appels.
    # 404 (jamais 403) pour ne pas divulguer l'existence (cohérent module).
    if _get_role(request) == "agent" and call.agent_user_id != _get_user_id(request):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="call_not_found")
    updated = await service.set_call_notes(db, company_id, call_id, body.notes)
    assert updated is not None
    return CallDetailOut(data=_call_out(updated))


@router.post(
    "/calls/click-to-call",
    response_model=CallDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def click_to_call_endpoint(
    body: ClickToCall,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CallDetailOut:
    """Originate : déclenche un appel sortant depuis l'extension de l'agent.

    Persiste un CDR (`outbound`, `ringing`) puis demande l'Originate à Asterisk
    via l'AMI. 503 si l'AMI est indisponible.
    """
    company_id = _get_company_id(request)
    user_id = _get_user_id(request)

    extension = body.agent_extension
    if extension is None:
        state = await service.get_agent_state(db, company_id, user_id)
        extension = state.extension if state else None
    if not extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="agent_extension_required"
        )

    # UNIQUEID imposé au canal Asterisk (ChannelId de l'Originate) = channel_id
    # du CDR → permet au worker de rapprocher l'enregistrement <UNIQUEID>.wav.
    channel_id = f"sgi-{uuid.uuid4().hex}"
    call = await service.create_call(
        db,
        company_id,
        direction="outbound",
        from_number=extension,
        to_number=body.to_number,
        client_id=body.client_id,
        agent_user_id=user_id,
        agent_extension=extension,
        channel_id=channel_id,
    )

    ami = get_client()
    if ami is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ami_unavailable"
        )
    try:
        await ami.originate(extension, body.to_number, channel_id=channel_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="originate_failed"
        ) from exc
    return CallDetailOut(data=_call_out(call))


# ── Présence agent ────────────────────────────────────────────────────────


@router.get(
    "/agents",
    response_model=AgentStateListOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def list_agents_endpoint(
    request: Request,
    status_: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db_session),
) -> AgentStateListOut:
    company_id = _get_company_id(request)
    states = await service.list_agent_states(db, company_id, status_)
    return AgentStateListOut(data=[AgentStateOut.model_validate(s) for s in states])


@router.get("/agents/me", response_model=AgentStateDetailOut)
async def my_agent_state_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> AgentStateDetailOut:
    company_id = _get_company_id(request)
    user_id = _get_user_id(request)
    state = await service.get_agent_state(db, company_id, user_id)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agent_state_not_found")
    return AgentStateDetailOut(data=AgentStateOut.model_validate(state))


@router.post("/agents/me/status", response_model=AgentStateDetailOut)
async def set_my_status_endpoint(
    body: AgentStatusSet,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> AgentStateDetailOut:
    company_id = _get_company_id(request)
    user_id = _get_user_id(request)
    try:
        state = await service.set_agent_status(
            db, company_id, user_id, body.status, extension=body.extension
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return AgentStateDetailOut(data=AgentStateOut.model_validate(state))


# ── Screen pop ────────────────────────────────────────────────────────────


@router.get(
    "/lookup",
    response_model=PhoneLookupOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def phone_lookup_endpoint(
    request: Request,
    phone: str = Query(..., min_length=3, description="Numéro appelant"),
    db: AsyncSession = Depends(get_db_session),
) -> PhoneLookupOut:
    """Résout les clients d'un numéro (screen pop). Filtré tenant (Loi 1)."""
    company_id = _get_company_id(request)
    clients = await service.find_clients_by_phone(db, company_id, phone)
    matches = [
        PhoneLookupMatch(
            client_id=c.id,
            display_name=(
                c.company_name or " ".join(filter(None, [c.first_name, c.last_name])) or "—"
            ),
            phone=c.phone,
            type=c.type,
        )
        for c in clients
    ]
    return PhoneLookupOut(data=matches)


# ── WebSocket événements d'appel ──────────────────────────────────────────


@router.websocket("/ws")
async def voice_ws_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT d'authentification"),
    extension: str = Query(..., description="Extension de l'agent"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """WS /api/v1/telephony/ws?token=<jwt>&extension=<ext>

    Auth JWT en query param. L'agent ne peut écouter QUE l'extension liée à son
    propre agent_state (anti-spoof intra-tenant). Channel namespacé par tenant.
    """
    from app.routers.telephony.service import get_agent_state

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

    # Le middleware tenant ne tourne pas sur le scope WS : on pose le contexte
    # RLS manuellement avant la vérification d'appartenance de l'extension.
    # GUC posé en portée SESSION (is_local=false) puis commit, comme
    # get_db_session : la connexion get_db étant épinglée, le contexte RLS
    # survit aux requêtes suivantes même sous le rôle restreint sgi_app (M-1).
    await db.execute(
        sql_text("SELECT set_config('app.current_company_id', :cid, false)"),
        {"cid": str(company_uuid)},
    )
    await db.commit()
    state = await get_agent_state(db, company_uuid, user_uuid)
    if state is None or state.extension != extension:
        await websocket.close(code=4403)
        return

    await voice_ws_handler(websocket, str(company_uuid), extension)


# ── Sous-routers montés ────────────────────────────────────────────────────
# Enregistrement des appels (PDPL) : GET /telephony/calls/{id}/recording.
router.include_router(recording_router)
