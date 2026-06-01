"""
Notification — notification in-app générique (M6), réutilisable par tout module.

Destinataire interne (`recipient_user_id`) ou client/propriétaire
(`recipient_party_id`). Canal in_app par défaut ; email/whatsapp/push possibles
(l'envoi réel passe par les tâches Celery `app.tasks.notifications`).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class Notification(Base, TimestampMixin, TenantMixin):
    """Notification in-app. Loi 1 (RLS)."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    recipient_party_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # statement_ready | payout_sent | mandate_expiring | kyc_verified | other
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    # in_app | email | whatsapp | push
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="in_app")

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload = mapped_column(JSONB, nullable=False, default=dict)

    # pending | sent | read
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_notifications_company", "company_id"),
        Index("idx_notifications_recipient_user", "company_id", "recipient_user_id", "status"),
        Index("idx_notifications_recipient_party", "company_id", "recipient_party_id", "status"),
        # Accélère la déduplication par type des tâches Celery (check_pdc_due,
        # check_maintenance_sla, notify_mentions) qui filtrent sur (company_id, type).
        Index("idx_notifications_company_type", "company_id", "type"),
    )
