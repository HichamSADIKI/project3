"""DeviceToken — jetons d'appareils mobiles/web pour les push (FCM/APNs).

Enregistré par l'app mobile au login ; consommé par la tâche Celery
``app.tasks.notifications.send_push`` pour cibler les appareils d'un utilisateur.
Loi 1 : ``company_id`` + RLS. Unicité du token par tenant (upsert au ré-enregistrement).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class DeviceToken(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Jeton push d'un appareil, rattaché à un utilisateur interne. Loi 1 (RLS)."""

    __tablename__ = "device_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Jeton fourni par le SDK (FCM registration token / APNs device token).
    token: Mapped[str] = mapped_column(String(512), nullable=False)
    # ios | android | web
    platform: Mapped[str] = mapped_column(String(10), nullable=False, default="android")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("company_id", "token", name="uq_device_tokens_company_token"),
        Index("idx_device_tokens_company", "company_id"),
        Index("idx_device_tokens_company_user", "company_id", "user_id"),
    )
