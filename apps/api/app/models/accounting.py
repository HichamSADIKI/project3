"""Modèles SQLAlchemy — Comptabilité (plan comptable + grand-livre).

3 tables métier (Loi 1 : company_id + RLS + index) :
- accounting_chart_accounts : plan comptable (code unique par société, self-FK parent).
- accounting_journal_entries : écritures de journal (réf JE-YYYY-NNNNN, machine à états).
- accounting_journal_lines : lignes d'écriture (débit XOR crédit), company_id DÉNORMALISÉ
  pour que la RLS s'applique directement à la table de lignes.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class ChartAccount(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Compte du plan comptable. `code` unique PAR société (multi-tenant)."""

    __tablename__ = "accounting_chart_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_fr: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # asset | liability | equity | revenue | expense
    type: Mapped[str] = mapped_column(String(20), nullable=False)

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounting_chart_accounts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_accounting_chart_accounts_code"),
    )


class JournalEntry(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Écriture de journal. `reference` JE-YYYY-NNNNN unique PAR société."""

    __tablename__ = "accounting_journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # draft | posted | void
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lines: Mapped[list["JournalLine"]] = relationship(
        back_populates="entry",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("company_id", "reference", name="uq_accounting_journal_entries_reference"),
    )


class JournalLine(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Ligne d'écriture : débit XOR crédit. `company_id` DÉNORMALISÉ (RLS Loi 1)."""

    __tablename__ = "accounting_journal_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounting_journal_entries.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounting_chart_accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    debit: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False, default=Decimal("0"))
    credit: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False, default=Decimal("0"))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    entry: Mapped[JournalEntry] = relationship(back_populates="lines")
