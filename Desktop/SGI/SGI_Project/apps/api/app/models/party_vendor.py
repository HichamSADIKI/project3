"""
Vendor — prestataire externe (maintenance, nettoyage, sécurité, autres).

Lié à Client (party). Notation moyenne mise à jour après chaque intervention.
Specialités et zones de service stockées en JSONB pour requêtes flexibles.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    DECIMAL,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
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

    # Catégorie principale (choisie à l'inscription)
    # maintenance | cleaning | security | landscaping | pest_control
    # | elevator | moving | hvac | electrical | plumbing | other
    vendor_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # Catégories activées par l'admin (1..n codes VendorType). Source de vérité
    # de « sur quoi ce fournisseur est activé ». Toujours ≥ 1 (≥ vendor_type).
    categories = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )

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

    # ── Onboarding fournisseur unifié (compte portail + licence + validation) ──

    # Compte de connexion (User role=fournisseur) qui pilote ce profil.
    # NULL = fiche créée en interne par l'agence sans compte portail.
    account_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Statut de validation KYC par un admin : pending | verified | rejected
    verification_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending", server_default="pending"
    )

    # Licence commerciale UAE uploadée (clé objet MinIO) + extraction OCR/IA
    commercial_license_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    commercial_license_extracted = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )

    # Traçabilité de la décision admin
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verified_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "verification_status IN ('pending','verified','rejected')",
            name="ck_vendors_verification_status",
        ),
        Index("idx_vendors_company", "company_id"),
        Index("idx_vendors_type", "vendor_type"),
        Index("idx_vendors_rating", "rating_avg"),
        Index("idx_vendors_licence_expiry", "trade_licence_expiry"),
        Index("idx_vendors_account_user", "account_user_id"),
        Index("idx_vendors_verification", "verification_status"),
    )
