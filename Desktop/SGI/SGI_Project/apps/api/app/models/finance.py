import uuid
from datetime import date, datetime

from sqlalchemy import DECIMAL, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class FinanceTransaction(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """
    Transaction financière (facture, paiement, dépense, commission, remboursement).
    Montants en AED, direction debit/credit.
    RLS actif via company_id (TenantMixin).
    """

    __tablename__ = "finance_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Référence lisible — unique PAR société (multi-tenant), pas globalement.
    reference: Mapped[str] = mapped_column(String(50), nullable=False)

    # Catégorie
    type: Mapped[str] = mapped_column(String(30), nullable=False)

    # Direction comptable
    direction: Mapped[str] = mapped_column(String(10), nullable=False, default="debit")

    # Montant
    amount: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AED")

    # Statut
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")

    # Descriptions multilingues
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description_ar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description_fr: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Liaisons optionnelles
    related_contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    related_client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    related_property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Échéances / paiement
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Moyen de paiement
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_reference: Mapped[str | None] = mapped_column(String(150), nullable=True)

    __table_args__ = (
        # Référence unique PAR société (multi-tenant) — pas globalement.
        UniqueConstraint(
            "company_id", "reference", name="uq_finance_transactions_company_reference"
        ),
    )
