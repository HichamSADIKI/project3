"""
OwnerStatement — relevé mensuel d'un propriétaire (M6).

Agrège, pour une période (année/mois), les revenus encaissés, les dépenses
(maintenance) et la commission de gestion → payout net dû au propriétaire.
Enregistrement persistant et immuable (historique) : statut draft → sent.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class OwnerStatement(Base, TimestampMixin, TenantMixin):
    """Relevé mensuel propriétaire. Loi 1 (RLS)."""

    __tablename__ = "owner_statements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    owner_party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("owners.party_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)

    gross_revenue_aed: Mapped[Decimal] = mapped_column(
        DECIMAL(15, 2), nullable=False, default=Decimal("0")
    )
    expenses_aed: Mapped[Decimal] = mapped_column(
        DECIMAL(15, 2), nullable=False, default=Decimal("0")
    )
    commission_aed: Mapped[Decimal] = mapped_column(
        DECIMAL(15, 2), nullable=False, default=Decimal("0")
    )
    net_payout_aed: Mapped[Decimal] = mapped_column(
        DECIMAL(15, 2), nullable=False, default=Decimal("0")
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AED")

    # draft | sent
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")

    line_items = mapped_column(JSONB, nullable=False, default=list)

    # Lien optionnel vers le PDF du relevé (module documents M2)
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_owner_statements_company", "company_id"),
        Index("idx_owner_statements_owner", "owner_party_id"),
        Index(
            "uq_owner_statements_period",
            "company_id",
            "owner_party_id",
            "period_year",
            "period_month",
            unique=True,
        ),
    )
