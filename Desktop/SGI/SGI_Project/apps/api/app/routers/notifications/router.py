"""Router FastAPI — Notifications in-app (M6)."""

import uuid
from datetime import timedelta
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_jwt, encode_jwt
from app.core.deps import get_db_session
from app.core.route_deps import get_company_id
from app.routers.notifications import service
from app.routers.notifications.schemas import (
    DeviceTokenListOut,
    DeviceTokenOut,
    DeviceTokenRegister,
    DeviceTokenResponse,
    MarkAllReadOut,
    NotificationListOut,
    NotificationOut,
    NotificationResponse,
    UnreadCountOut,
)
from app.routers.notifications.ws import notifications_ws_handler

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _current_user_id(request: Request) -> uuid.UUID | None:
    raw = getattr(request.state, "user_id", None)
    return uuid.UUID(raw) if raw else None


@router.get("/", response_model=NotificationListOut)
async def list_notifications_endpoint(
    request: Request,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> NotificationListOut:
    """Notifications de l'utilisateur courant (destinataire interne)."""
    company_id = await get_company_id(db)
    user_id = _current_user_id(request)
    notifs = await service.list_notifications(
        db,
        company_id,
        recipient_user_id=user_id,
        status=status_filter,
        page=page,
        limit=limit,
    )
    return NotificationListOut(
        data=[NotificationOut.model_validate(n) for n in notifs],
        meta={"page": page, "limit": limit},
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read_endpoint(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> NotificationResponse:
    company_id = await get_company_id(db)
    notif = await service.get_notification(db, company_id, notification_id)
    if notif is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="notification_not_found")
    notif = await service.mark_read(db, notif)
    return NotificationResponse(data=NotificationOut.model_validate(notif))


# ─── Jetons d'appareils (push) ───────────────────────────────────────────────


def _require_user_id(request: Request) -> uuid.UUID:
    user_id = _current_user_id(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthenticated")
    return user_id


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> UnreadCountOut:
    """Nombre de notifications non lues de l'utilisateur courant (badge cloche)."""
    company_id = await get_company_id(db)
    user_id = _current_user_id(request)
    if user_id is None:
        return UnreadCountOut(data={"count": 0})
    count = await service.count_unread(db, company_id, user_id)
    return UnreadCountOut(data={"count": count})


@router.post("/read-all", response_model=MarkAllReadOut)
async def mark_all_read_endpoint(
    user_id: uuid.UUID = Depends(_require_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> MarkAllReadOut:
    """Marque toutes les notifications de l'utilisateur courant comme lues."""
    company_id = await get_company_id(db)
    updated = await service.mark_all_read(db, company_id, user_id)
    return MarkAllReadOut(data={"updated": updated})


@router.post("/devices", response_model=DeviceTokenResponse, status_code=status.HTTP_201_CREATED)
async def register_device_endpoint(
    request: Request,
    body: DeviceTokenRegister,
    db: AsyncSession = Depends(get_db_session),
) -> DeviceTokenResponse:
    """Enregistre un jeton push pour l'utilisateur courant (appelé par le mobile)."""
    company_id = await get_company_id(db)
    user_id = _require_user_id(request)
    device = await service.register_device_token(
        db, company_id, user_id, token=body.token, platform=body.platform
    )
    return DeviceTokenResponse(data=DeviceTokenOut.model_validate(device))


@router.get("/devices", response_model=DeviceTokenListOut)
async def list_devices_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> DeviceTokenListOut:
    """Jetons actifs de l'utilisateur courant."""
    company_id = await get_company_id(db)
    user_id = _require_user_id(request)
    devices = await service.list_device_tokens(db, company_id, user_id)
    return DeviceTokenListOut(
        data=[DeviceTokenOut.model_validate(d) for d in devices],
        meta={"total": len(devices)},
    )


@router.delete("/devices", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device_endpoint(
    request: Request,
    token: str = Query(..., min_length=8, max_length=512),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Désinscrit un jeton de l'utilisateur courant (BOLA : scopé à l'user)."""
    company_id = await get_company_id(db)
    user_id = _require_user_id(request)
    removed = await service.delete_device_token(db, company_id, user_id, token)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/ws-ticket")
async def ws_ticket_endpoint(request: Request) -> dict[str, Any]:
    """Jeton WS court (60 s) pour ouvrir le flux temps réel depuis le navigateur.

    Le JWT de session est httpOnly (inaccessible au JS) : on délivre ici un
    jeton dédié, à durée de vie très courte, portant uniquement (sub, company_id,
    role). Réduit la fenêtre d'exposition si le ticket fuite côté client."""
    user_id = _current_user_id(request)
    company_id = getattr(request.state, "company_id", None)
    role = getattr(request.state, "role", None)
    if user_id is None or not company_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthenticated")
    ticket = encode_jwt(
        {"sub": str(user_id), "company_id": str(company_id), "role": role},
        expires_delta=timedelta(seconds=60),
    )
    return {"success": True, "data": {"ticket": ticket}}


@router.websocket("/ws")
async def notifications_ws_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT d'authentification"),
) -> None:
    """WS /api/v1/notifications/ws?token=<jwt> — flux personnel temps réel.

    Auth JWT en query param (le middleware tenant ne tourne pas sur le scope WS).
    Le channel est dérivé **du token** (company_id + sub) : un utilisateur ne
    peut s'abonner qu'à SON propre flux — pas d'injection de cible (Loi 1 + BOLA).
    """
    try:
        payload = decode_jwt(token)
        company_id = payload.get("company_id")
        user_id = payload.get("sub")
        if not company_id or not user_id or payload.get("mfa_pending"):
            await websocket.close(code=4401)
            return
        uuid.UUID(company_id)
        uuid.UUID(user_id)
    except Exception:  # noqa: BLE001
        await websocket.close(code=4401)
        return
    await notifications_ws_handler(websocket, company_id, user_id)
