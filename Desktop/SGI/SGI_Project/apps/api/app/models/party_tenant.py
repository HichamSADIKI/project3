"""
TenantProfile — profil 'locataire' d'un client (party).

Couvre le cycle de vie complet :
  candidate → active → former
                    └→ blacklisted

Un candidate devient `active` à la signature du premier bail.
Un active devient `former` à la fin du dernier bail actif.
Loyalty score (0-100) calculé à partir de l'historique de paiement.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class TenantProfile(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Profil Locataire (et candidate avant signature) — étend Client."""

    __tablename__ = "tenant_profiles"

    party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Cycle de vie
    lifecycle_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="candidate"
    )

    # Documents UAE
    emirates_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emirates_id_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    passport_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    passport_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Visa
    visa_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    visa_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    # employment | family | golden | visit | other
    visa_type: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Solvabilité
    monthly_income_aed: Mapped[Decimal | None] = mapped_column(
        DECIMAL(15, 2), nullable=True
    )
    employer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    employer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Contact d'urgence
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emergency_contact_relation: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )

    # Loyauté (0-100) calculée à partir de l'historique
    loyalty_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)

    # KYC — vérification d'identité (workflow M4)
    # not_started → pending → verified | rejected
    kyc_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="not_started"
    )
    kyc_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    kyc_verified_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    kyc_rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Jalons du cycle de vie
    candidacy_submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    candidacy_approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    blacklisted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    blacklist_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("idx_tenants_company", "company_id"),
        Index("idx_tenants_lifecycle", "lifecycle_status"),
        Index("idx_tenants_visa_expiry", "visa_expiry"),
    )
