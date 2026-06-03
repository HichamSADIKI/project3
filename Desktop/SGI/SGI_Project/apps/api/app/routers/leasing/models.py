"""Modèles SQLAlchemy — Leasing / Location (migration 0035).

- `rental_listings`     : annonce de location d'une unité (cycle de vie draft→leased).
- `rental_applications` : candidature locataire sur une annonce (cycle submitted→converted).

RLS via company_id (Loi 1). Montants AED en Numeric(15,2). Dates timezone-aware.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class RentalListing(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Annonce de location rattachée (optionnellement) à une unité. RLS via company_id."""

    __tablename__ = "rental_listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    # Le bien loué (optionnel : une annonce peut être créée avant d'être rattachée
    # à une unité précise). RESTRICT : on n'efface pas une unité encore annoncée.
    unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units.id", ondelete="RESTRICT"), nullable=True
    )
    title_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title_fr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    monthly_rent: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False)
    annual_rent: Mapped[Decimal | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    available_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RentalApplication(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Candidature d'un client sur une annonce de location. RLS via company_id."""

    __tablename__ = "rental_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rental_listings.id", ondelete="CASCADE"),
        nullable=False,
    )
    applicant_client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    offered_rent: Mapped[Decimal | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="submitted")
    screening_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Renseigné quand la candidature approuvée est convertie en bail effectif.
    converted_rental_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rentals.id", ondelete="SET NULL"), nullable=True
    )
