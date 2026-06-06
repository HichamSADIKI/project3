"""
Modèles Paiements SGI (Phase 8).

Architecture :
- PaymentRequest    : demande de paiement émise (loyer, charges, dépôt, remboursement).
  Statut : pending → paid | overdue | cancelled.
- PaymentTransaction: transaction réelle liée à une demande (simulation UAE).
  UAE : chèques PDC déjà couverts par pdc_cheques. Ce module couvre les
  paiements en ligne (virement, carte) — statut : initiated → settled | failed.

Loi 1 : company_id NOT NULL + RLS (migration 0019).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    DECIMAL,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class PaymentRequest(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Demande de paiement émise par l'agence à un locataire / propriétaire.

    Machine à états : pending → paid (terminal) | overdue | cancelled (terminal)
                      overdue → paid (terminal)
    """

    __tablename__ = "payment_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Référence lisible — PAY-YYYY-NNNNNN
    reference: Mapped[str] = mapped_column(String(20), nullable=False)

    # Débiteur (locataire qui paie)
    tenant_client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    # Créditeur (propriétaire qui reçoit)
    owner_client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    # Contexte
    unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("units.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    rental_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rentals.id", ondelete="RESTRICT"),
        nullable=True,
    )

    # rent | charges | deposit | deposit_return | owner_payout | other
    payment_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # pending | paid | overdue | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    amount_aed: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "payment_type IN ('rent','charges','deposit','deposit_return','owner_payout','other')",
            name="ck_pay_req_type",
        ),
        CheckConstraint(
            "status IN ('pending','paid','overdue','cancelled')",
            name="ck_pay_req_status",
        ),
        Index("uq_pay_req_company_ref", "company_id", "reference", unique=True),
        Index("idx_pay_req_company_status", "company_id", "status"),
        Index("idx_pay_req_due_date", "due_date"),
    )


class PaymentTransaction(Base, TimestampMixin, TenantMixin):
    """Transaction de paiement réelle liée à une demande.

    Statut : initiated → settled (terminal) | failed (terminal)
    """

    __tablename__ = "payment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_requests.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # initiated | settled | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="initiated")
    # bank_transfer | card | cash | cheque | online
    method: Mapped[str] = mapped_column(String(30), nullable=False)
    amount_aed: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False)
    # Référence externe (numéro de virement, ID Stripe-like…)
    external_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('initiated','settled','failed')",
            name="ck_pay_tx_status",
        ),
        CheckConstraint(
            "method IN ('bank_transfer','card','cash','cheque','online')",
            name="ck_pay_tx_method",
        ),
        Index("idx_pay_tx_request", "request_id"),
        Index("idx_pay_tx_company_status", "company_id", "status"),
    )
