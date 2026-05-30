import uuid
from datetime import datetime

from sqlalchemy import DECIMAL, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class PartnerCommissionEntry(Base, TimestampMixin, TenantMixin):
    """Entrée de commission due à un partenaire.

    Pas de soft-delete : les commissions ne disparaissent pas, elles passent
    de pending → payable → paid (ou cancelled).
    """

    __tablename__ = "partner_commission_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    base_amount_aed: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    commission_rate: Mapped[float] = mapped_column(DECIMAL(5, 2), nullable=False)
    commission_amount_aed: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finance_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("finance_transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
