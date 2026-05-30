"""
Owner — profil 'propriétaire' d'un client (party).

Une ligne `owners` étend une ligne `clients` (FK 1-1 via party_id PK).
Une `Client` peut avoir 0 ou 1 profil Owner. Le profil porte le mandat de
gestion et les coordonnées bancaires de paiement des revenus locatifs.

Conformité UAE :
- Emirates ID + expiration suivie (alerte avant échéance)
- Mandat de gestion = document obligatoire, archivé via MinIO
- IBAN UAE pour reversement des loyers nets
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, Boolean, Date, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Owner(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Profil Propriétaire — étend Client via party_id (FK 1-1)."""

    __tablename__ = "owners"

    # PK = FK vers clients.id — un seul profil owner par client
    party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Résidence fiscale UAE
    residency_uae: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Documents d'identité
    emirates_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emirates_id_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    passport_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    passport_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Mandat de gestion (loi UAE — document obligatoire)
    mandate_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mandate_signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    mandate_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    mandate_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Commission de gestion (% sur loyers encaissés)
    mandate_commission_rate: Mapped[Decimal | None] = mapped_column(DECIMAL(5, 2), nullable=True)

    # Chemin MinIO du PDF du mandat
    mandate_document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Reversement des revenus nets
    bank_iban: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_swift: Mapped[str | None] = mapped_column(String(20), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    preferred_payout_method: Mapped[str] = mapped_column(
        String(30), nullable=False, default="bank_transfer"
    )

    # Préférences de communication
    monthly_statement_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expense_approval_threshold_aed: Mapped[Decimal | None] = mapped_column(
        DECIMAL(15, 2), nullable=True
    )

    __table_args__ = (
        Index("idx_owners_company", "company_id"),
        Index("idx_owners_mandate_end", "mandate_end_date"),
    )
