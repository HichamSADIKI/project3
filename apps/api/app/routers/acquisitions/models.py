"""Modèles SQLAlchemy — Acquisitions (migration 0033).

- `buyer_mandates`  : mandat d'achat acquéreur (budget, critères, point + rayon
  de recherche PostGIS). RLS via company_id (Loi 1).
- `purchase_offers` : offre d'achat sur un bien donné, rattachée à un mandat.
  RLS via company_id (Loi 1).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import DECIMAL, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class BuyerMandate(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Mandat d'achat d'un acquéreur. RLS via company_id.

    Le point de recherche est stocké en PostGIS GEOMETRY(Point, 4326) —
    cohérent avec `properties.location` (Loi 2) — et combiné à `search_radius_m`
    pour le rapprochement géographique (`ST_DWithin` en geography).
    """

    __tablename__ = "buyer_mandates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Référence triable — unique PAR société (multi-tenant), pas globalement.
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    buyer_client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    budget_min: Mapped[Decimal | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    budget_max: Mapped[Decimal | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    property_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    bedrooms_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Point de recherche PostGIS (Loi 2) + rayon en mètres.
    preferred_location = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    search_radius_m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PurchaseOffer(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Offre d'achat sur un bien, rattachée à un mandat acquéreur. RLS via company_id."""

    __tablename__ = "purchase_offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Référence triable — unique PAR société (multi-tenant), pas globalement.
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    mandate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("buyer_mandates.id", ondelete="CASCADE"), nullable=False
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
