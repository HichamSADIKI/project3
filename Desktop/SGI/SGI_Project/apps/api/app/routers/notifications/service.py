"""Service — Notifications in-app (M6). Filtrer par company_id (Loi 1)."""
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

VALID_CHANNELS: frozenset[str] = frozenset({"in_app", "email", "whatsapp", "push"})

# Transitions de statut d'une notification.
_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"sent", "read"},
    "sent": {"read"},
    "read": set(),
}


# ─── Helpers purs ──────────────────────────────────────────────────────────


def is_valid_status_transition(current: str, target: str) -> bool:
    return target in _STATUS_TRANSITIONS.get(current, set())


def is_valid_channel(channel: str) -> bool:
    return channel in VALID_CHANNELS


# ─── DB ─────────────────────────────────────────────────────────────────────


async def create_notification(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    notif_type: str,
    title: str,
    body: str | None = None,
    channel: str = "in_app",
    recipient_user_id: uuid.UUID | None = None,
    recipient_party_id: uuid.UUID | None = None,
    payload: dict[str, Any] | None = None,
    commit: bool = True,
) -> Notification:
    notif = Notification(
        company_id=company_id,
        type=notif_type,
        title=title,
        body=body,
        channel=channel,
        recipient_user_id=recipient_user_id,
        recipient_party_id=recipient_party_id,
        payload=payload or {},
        status="sent" if channel == "in_app" else "pending",
        sent_at=datetime.now(UTC) if channel == "in_app" else None,
    )
    db.add(notif)
    if commit:
        await db.commit()
        await db.refresh(notif)
    return notif


async def list_notifications(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    recipient_user_id: uuid.UUID | None = None,
    recipient_party_id: uuid.UUID | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> list[Notification]:
    query = select(Notification).where(Notification.company_id == company_id)
    if recipient_user_id is not None:
        query = query.where(Notification.recipient_user_id == recipient_user_id)
    if recipient_party_id is not None:
        query = query.where(Notification.recipient_party_id == recipient_party_id)
    if status:
        query = query.where(Notification.status == status)
    query = query.order_by(Notification.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_notification(
    db: AsyncSession, company_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification | None:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.company_id == company_id,
        )
    )
    return result.scalar_one_or_none()


async def mark_read(db: AsyncSession, notif: Notification) -> Notification:
    notif.status = "read"
    notif.read_at = datetime.now(UTC)
    notif.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(notif)
    return notif
