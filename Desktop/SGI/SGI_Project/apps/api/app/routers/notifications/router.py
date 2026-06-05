"""Router FastAPI — Notifications in-app (M6)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id
from app.routers.notifications import service
from app.routers.notifications.schemas import (
    DeviceTokenListOut,
    DeviceTokenOut,
    DeviceTokenRegister,
    DeviceTokenResponse,
    NotificationListOut,
    NotificationOut,
    NotificationResponse,
)

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
