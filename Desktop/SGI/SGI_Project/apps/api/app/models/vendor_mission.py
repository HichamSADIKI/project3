"""VendorMission — ordre de mission / intervention confié à un fournisseur.

Rattaché à `vendors.party_id`. Machine à états :
  assigned → accepted → in_progress → done | cancelled
"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    DECIMAL,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class VendorMission(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    __tablename__ = "vendor_missions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    vendor_party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.party_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # assigned | accepted | in_progress | done | cancelled
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="assigned", server_default="assigned"
    )
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    location_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount_aed: Mapped[Decimal | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('assigned','accepted','in_progress','done','cancelled')",
            name="ck_vendor_missions_status",
        ),
        Index("idx_vendor_missions_company", "company_id"),
        Index("idx_vendor_missions_vendor", "vendor_party_id"),
        Index("idx_vendor_missions_status", "status"),
    )
