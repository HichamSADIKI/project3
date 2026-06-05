"""Service — Notifications in-app (M6). Filtrer par company_id (Loi 1)."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_token import DeviceToken
from app.models.notification import Notification

VALID_CHANNELS: frozenset[str] = frozenset({"in_app", "email", "whatsapp", "push"})
VALID_PLATFORMS: frozenset[str] = frozenset({"ios", "android", "web"})


def is_valid_platform(platform: str) -> bool:
    return platform in VALID_PLATFORMS


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
        # Push temps réel best-effort : notif in-app destinée à un utilisateur
        # précis → flux WS personnel. N'échoue jamais la requête métier.
        if channel == "in_app" and recipient_user_id is not None:
            from app.routers.notifications.ws import publish_notification

            await publish_notification(
                company_id,
                recipient_user_id,
                {
                    "type": "notification.created",
                    "data": {
                        "id": str(notif.id),
                        "type": notif.type,
                        "title": notif.title,
                        "body": notif.body,
                        "created_at": notif.created_at.isoformat() if notif.created_at else None,
                    },
                },
            )
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


async def count_unread(
    db: AsyncSession, company_id: uuid.UUID, recipient_user_id: uuid.UUID
) -> int:
    """Nombre de notifications non lues (statut != 'read') de l'utilisateur courant."""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.company_id == company_id,
            Notification.recipient_user_id == recipient_user_id,
            Notification.status != "read",
        )
    )
    return int(result.scalar_one())


async def mark_all_read(
    db: AsyncSession, company_id: uuid.UUID, recipient_user_id: uuid.UUID
) -> int:
    """Marque comme lues toutes les notifications non lues de l'utilisateur. Renvoie le nombre."""
    now = datetime.now(UTC)
    result = await db.execute(
        update(Notification)
        .where(
            Notification.company_id == company_id,
            Notification.recipient_user_id == recipient_user_id,
            Notification.status != "read",
        )
        .values(status="read", read_at=now, updated_at=now)
    )
    await db.commit()
    return int(result.rowcount or 0)  # type: ignore[attr-defined]


# ─── Jetons d'appareils (push) ───────────────────────────────────────────────


async def register_device_token(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    token: str,
    platform: str,
) -> DeviceToken:
    """Enregistre (ou réactive) un jeton push. Idempotent par (company_id, token).

    Si le token existe déjà dans le tenant, on le rattache à l'utilisateur courant,
    met à jour la plateforme et le réactive (au cas où il aurait été supprimé) —
    plutôt que d'insérer un doublon (la contrainte d'unicité l'interdirait).
    """
    existing = (
        await db.execute(
            select(DeviceToken).where(
                DeviceToken.company_id == company_id,
                DeviceToken.token == token,
            )
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if existing is not None:
        existing.user_id = user_id
        existing.platform = platform
        existing.deleted_at = None
        existing.last_seen_at = now
        existing.updated_at = now
        await db.commit()
        await db.refresh(existing)
        return existing
    device = DeviceToken(
        company_id=company_id,
        user_id=user_id,
        token=token,
        platform=platform,
        last_seen_at=now,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


async def delete_device_token(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    token: str,
) -> bool:
    """Soft-delete d'un jeton de l'utilisateur courant. Renvoie False si absent.

    Scopé à ``user_id`` : un utilisateur ne peut désinscrire que ses propres
    appareils (BOLA horizontal).
    """
    device = (
        await db.execute(
            select(DeviceToken).where(
                DeviceToken.company_id == company_id,
                DeviceToken.user_id == user_id,
                DeviceToken.token == token,
                DeviceToken.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if device is None:
        return False
    device.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


async def list_device_tokens(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> list[DeviceToken]:
    """Jetons actifs de l'utilisateur courant."""
    result = await db.execute(
        select(DeviceToken)
        .where(
            DeviceToken.company_id == company_id,
            DeviceToken.user_id == user_id,
            DeviceToken.deleted_at.is_(None),
        )
        .order_by(DeviceToken.created_at.desc())
    )
    return list(result.scalars().all())
