"""Modèles SQLAlchemy — module Vente (migration 0034_sales).

Quatre tables à cycle de vie, toutes RLS via company_id (Loi 1) :
- sale_mandates      : mandat de vente confié par un vendeur
- sale_listings      : annonce publiée à partir d'un mandat
- sale_offers        : offre d'achat déposée sur une annonce
- sale_transactions  : transaction conclue + commission de l'agence
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class SaleMandate(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Mandat de vente — un vendeur (client) confie un bien à l'agence."""

    __tablename__ = "sale_mandates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    seller_client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="RESTRICT"), nullable=True
    )
    mandate_type: Mapped[str] = mapped_column(String(20), nullable=False, default="exclusive")
    commission_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("2.00")
    )
    asking_price: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SaleListing(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Annonce de vente publiée à partir d'un mandat — entité multilingue."""

    __tablename__ = "sale_listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    mandate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sale_mandates.id", ondelete="CASCADE"), nullable=False
    )
    title_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title_fr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    list_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Vitrine publique (migration 0038). slug unique par tenant (index partiel).
    slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_urgent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class SaleOffer(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Offre d'achat déposée par un acheteur (client) sur une annonce."""

    __tablename__ = "sale_offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sale_listings.id", ondelete="CASCADE"), nullable=False
    )
    buyer_client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="submitted")
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SaleTransaction(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Transaction de vente conclue + commission de l'agence."""

    __tablename__ = "sale_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sale_listings.id", ondelete="RESTRICT"), nullable=False
    )
    offer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sale_offers.id", ondelete="RESTRICT"), nullable=True
    )
    final_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
