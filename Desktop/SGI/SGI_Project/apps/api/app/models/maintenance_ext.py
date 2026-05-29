"""
Modèles d'extension du module Maintenance (Phase 2) :
- MaintenanceQuote   : devis soumis par un vendor pour un ticket.
- MaintenanceInvoice : facture émise après intervention.
- MaintenancePlan    : plan de maintenance préventive (générer tickets auto).

Loi 1 : company_id NOT NULL + RLS sur chaque table (migration 0014).
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    DECIMAL,
    Boolean,
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


class MaintenanceQuote(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Devis soumis par un vendor externe pour un ticket de maintenance."""

    __tablename__ = "maintenance_quotes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("maintenance_tickets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    vendor_party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount_aed: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending | approved | rejected | expired
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Clé MinIO vers le PDF du devis (optionnel).
    file_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','approved','rejected','expired')",
            name="ck_mnt_quotes_status",
        ),
        Index("idx_mnt_quotes_ticket", "ticket_id"),
        Index("idx_mnt_quotes_company_status", "company_id", "status"),
    )


class MaintenanceInvoice(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Facture émise par un vendor après intervention validée."""

    __tablename__ = "maintenance_invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("maintenance_tickets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    vendor_party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount_aed: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft | issued | paid | overdue
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Lien vers la transaction financière une fois payée.
    finance_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("finance_transactions.id", ondelete="RESTRICT"),
        nullable=True,
    )
    file_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','issued','paid','overdue')",
            name="ck_mnt_invoices_status",
        ),
        Index("idx_mnt_invoices_ticket", "ticket_id"),
        Index("idx_mnt_invoices_company_status", "company_id", "status"),
    )


class MaintenancePlan(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Plan de maintenance préventive — génère automatiquement des tickets."""

    __tablename__ = "maintenance_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Localisation : unit OU building.
    unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("units.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    building_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("buildings.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    priority: Mapped[str] = mapped_column(
        String(10), nullable=False, default="medium"
    )
    # Expression cron (ex. "0 9 1 * *" = le 1er de chaque mois à 9h).
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    next_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    last_generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint(
            "unit_id IS NOT NULL OR building_id IS NOT NULL",
            name="ck_mnt_plans_location",
        ),
        CheckConstraint(
            "category IN ('plumbing','electrical','hvac','appliance','structural','cleaning','other')",
            name="ck_mnt_plans_category",
        ),
        CheckConstraint(
            "priority IN ('low','medium','high','urgent')",
            name="ck_mnt_plans_priority",
        ),
        Index("idx_mnt_plans_company_active", "company_id", "active"),
        Index("idx_mnt_plans_next_due", "next_due_at"),
    )
