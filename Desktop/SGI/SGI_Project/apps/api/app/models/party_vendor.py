"""
Vendor — prestataire externe (maintenance, nettoyage, sécurité, autres).

Lié à Client (party). Notation moyenne mise à jour après chaque intervention.
Specialités et zones de service stockées en JSONB pour requêtes flexibles.
"""
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import DECIMAL, Boolean, Date, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Vendor(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Profil Prestataire externe — étend Client."""

    __tablename__ = "vendors"

    party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Catégorie globale
    # maintenance | cleaning | security | landscaping | pest_control
    # | elevator | moving | hvac | electrical | plumbing | other
    vendor_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # Spécialités fines stockées en JSONB (sous-catégories libres)
    specialities = mapped_column(JSONB, nullable=False, default=list)

    # Zones de service (codes émirats : DXB, AUH, SHJ, AJM, RAK, FUJ, UAQ)
    service_areas = mapped_column(JSONB, nullable=False, default=list)

    # Licence commerciale UAE
    trade_licence_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    trade_licence_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    trade_licence_authority: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    # Assurance responsabilité civile prestataires
    insurance_policy_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    insurance_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Notation cumulée (5 étoiles)
    rating_avg: Mapped[Decimal] = mapped_column(
        DECIMAL(3, 2), nullable=False, default=0
    )
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # KPI opérationnels (mis à jour par job batch)
    response_time_hours_avg: Mapped[Decimal | None] = mapped_column(
        DECIMAL(5, 2), nullable=True
    )
    on_time_rate: Mapped[Decimal | None] = mapped_column(
        DECIMAL(5, 2), nullable=True
    )
    jobs_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    jobs_cancelled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Conditions commerciales
    # net_15 | net_30 | net_60 | on_completion | advance_50
    preferred_payment_terms: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    emergency_24_7: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Statut d'éligibilité au marketplace (pause manuelle possible)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_vendors_company", "company_id"),
        Index("idx_vendors_type", "vendor_type"),
        Index("idx_vendors_rating", "rating_avg"),
        Index("idx_vendors_licence_expiry", "trade_licence_expiry"),
    )
