import uuid
from datetime import date, datetime

from sqlalchemy import (
    DECIMAL,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Contract(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """
    Contrat de vente ou de location.
    Référence auto-générée : "CNT-2024-001".
    Commission calculée par le service ; documents stockés dans MinIO (chemins JSONB).
    RLS actif via company_id (TenantMixin).
    """

    __tablename__ = "contracts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Référence lisible — unique PAR société (multi-tenant), pas globalement.
    reference: Mapped[str] = mapped_column(String(50), nullable=False)

    # "sale" | "rental"
    type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Parties
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Montants AED
    amount: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    commission_rate: Mapped[float] = mapped_column(
        DECIMAL(5, 2), nullable=False, default=2.0
    )
    commission_amount: Mapped[float | None] = mapped_column(
        DECIMAL(15, 2), nullable=True
    )

    # Cycle de vie
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Notes multilingues
    notes_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_fr: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Documents MinIO (chemins)
    documents = mapped_column(JSONB, nullable=False, default=list)

    # Métadonnées additionnelles
    metadata_ = mapped_column("metadata", JSONB, nullable=False, default=dict)

    # Renouvellement (M5) — contrat parent dont celui-ci est le renouvellement
    renewed_from_contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # E-signature (M5) — document M2 servant de support de signature
    signing_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    __table_args__ = (
        # Référence unique PAR société (multi-tenant) — pas globalement.
        UniqueConstraint("company_id", "reference", name="uq_contracts_company_reference"),
    )
