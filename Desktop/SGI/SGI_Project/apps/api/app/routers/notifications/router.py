"""Router FastAPI — Notifications in-app (M6)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id
from app.routers.notifications import service
from app.routers.notifications.schemas import (
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
