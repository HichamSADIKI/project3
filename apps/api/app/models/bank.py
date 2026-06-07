"""Modèles SQLAlchemy — Rapprochement bancaire.

2 tables métier (Loi 1 : company_id + RLS + index) :
- bank_accounts : comptes bancaires du tenant.
- bank_statement_lines : lignes de relevé (montant SIGNÉ), rapprochées ou non à
  une transaction finance (matched_transaction_id).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class BankAccount(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Compte bancaire du tenant."""

    __tablename__ = "bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    account_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AED")
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)


class BankStatementLine(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Ligne de relevé bancaire. `amount` SIGNÉ (+ entrée / − sortie).

    Rapprochée (status='reconciled') quand liée à une transaction finance via
    `matched_transaction_id`. `status` ∈ {unreconciled, reconciled}.
    """

    __tablename__ = "bank_statement_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    bank_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bank_accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    value_date: Mapped[date] = mapped_column(Date, nullable=False)
    label: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unreconciled")
    matched_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("finance_transactions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    matched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
