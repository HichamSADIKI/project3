"""
Modèles Inspections + Check-in/Check-out SGI (Phase 7).

Architecture :
- Inspection        : état des lieux lié à une unit (check_in, check_out,
                      periodic, pre_sale). Machine à états :
                      draft → scheduled → in_progress → completed → signed.
- InspectionSection : section de l'inspection (salon, cuisine, chambre…).
- InspectionItem    : item noté dans une section (état, note /5, commentaire).
- InspectionPhoto   : photo MinIO liée à un item.

Loi 1 : company_id NOT NULL + RLS sur les 4 tables (migration 0018).
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Inspection(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """État des lieux / inspection d'une unité.

    Machine à états :
      draft → scheduled → in_progress → completed → signed (terminal)
      tout état → cancelled (terminal)
    """

    __tablename__ = "inspections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Référence lisible — INS-YYYY-NNNNNN
    reference: Mapped[str] = mapped_column(String(20), nullable=False)

    unit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("units.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # Lien contextuel optionnel
    rental_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rentals.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # check_in | check_out | periodic | pre_sale
    inspection_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # draft | scheduled | in_progress | completed | signed | cancelled
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )

    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    inspector_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    # Parties prenantes (locataire, propriétaire)
    tenant_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Signature numérique simulée (nom + timestamp)
    signed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Score global calculé (moyenne des items notés, 0-5)
    overall_score: Mapped[float | None] = mapped_column(
        nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "inspection_type IN ('check_in','check_out','periodic','pre_sale')",
            name="ck_inspection_type",
        ),
        CheckConstraint(
            "status IN ('draft','scheduled','in_progress','completed','signed','cancelled')",
            name="ck_inspection_status",
        ),
        Index("idx_inspections_company_status",  "company_id", "status"),
        Index("idx_inspections_company_type",    "company_id", "inspection_type"),
        Index("uq_inspections_company_ref", "company_id", "reference", unique=True),
    )


class InspectionSection(Base, TenantMixin):
    """Section d'une inspection (ex. Salon, Cuisine, Chambre 1…)."""

    __tablename__ = "inspection_sections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    inspection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    section_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_insp_sections_inspection", "inspection_id"),
    )


class InspectionItem(Base, TenantMixin):
    """Item noté dans une section (état d'un équipement ou d'une surface)."""

    __tablename__ = "inspection_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inspection_sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Libellé de l'item (ex. "Parquet", "Robinetterie", "Fenêtre")
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    item_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # good | fair | poor | missing | na
    condition: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Note 0-5 (null = non noté)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "condition IS NULL OR condition IN ('good','fair','poor','missing','na')",
            name="ck_item_condition",
        ),
        CheckConstraint(
            "score IS NULL OR (score >= 0 AND score <= 5)",
            name="ck_item_score",
        ),
        Index("idx_insp_items_section", "section_id"),
    )


class InspectionPhoto(Base, TenantMixin):
    """Photo MinIO associée à un item d'inspection."""

    __tablename__ = "inspection_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inspection_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Clé objet MinIO
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        Index("idx_insp_photos_item", "item_id"),
    )
