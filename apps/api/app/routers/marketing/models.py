"""Modèles SQLAlchemy — Marketing (migration 0036).

- `marketing_campaigns`      : campagne de diffusion (canal, période, métriques).
- `marketing_campaign_units` : jointure N:N campagne ↔ unité commercialisée.

RLS via company_id (Loi 1) — portée AUSSI sur la table de jointure. Montants AED
en Numeric(15,2). Dates timezone-aware. Soft-delete sur la campagne.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class MarketingCampaign(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Campagne marketing rattachée à un canal de diffusion. RLS via company_id."""

    __tablename__ = "marketing_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Canal de diffusion — aligné EXACTEMENT sur le CHECK (migration 0036).
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    budget_aed: Mapped[Decimal | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    spend_aed: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False, default=0)
    # Métriques au niveau campagne.
    impressions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    leads_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Identifiant renvoyé par le connecteur de publication (stub).
    external_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class MarketingCampaignUnit(Base, TimestampMixin, TenantMixin):
    """Lien campagne ↔ unité commercialisée. Porte company_id (RLS homogène, Loi 1)."""

    __tablename__ = "marketing_campaign_units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketing_campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    # RESTRICT : on n'efface pas une unité encore liée à une campagne.
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units.id", ondelete="RESTRICT"), nullable=False
    )
