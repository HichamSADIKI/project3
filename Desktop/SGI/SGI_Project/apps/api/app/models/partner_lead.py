import uuid

from sqlalchemy import DECIMAL, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class PartnerLead(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Lead apporté par un partenaire (apporteur d'affaires)."""

    __tablename__ = "partner_leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    submitter_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    prospect_first_name: Mapped[str] = mapped_column(String(150), nullable=False)
    prospect_last_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    prospect_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prospect_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    prospect_nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    interest_type: Mapped[str] = mapped_column(String(20), nullable=False)
    budget_aed: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    converted_client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
    )
    commission_rate: Mapped[float | None] = mapped_column(DECIMAL(5, 2), nullable=True)
