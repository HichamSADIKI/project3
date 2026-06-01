"""
PdcCheque — chèque post-daté (Post-Dated Cheque).

Citoyen de première classe du module UAE. Un PDC :
- est attaché à un Rental (ou un Contract de vente échelonnée)
- a un calendrier de dépôt (`due_date` → `deposit_date`)
- traverse un état : pending → deposited → cleared | bounced | cancelled
- en cas de bounce, est `replaced_by_pdc_id` pointant vers le PDC qui le remplace
- stocke le scan OCR (`document_path` MinIO + `ocr_data` JSONB)

Législation UAE : chèque sans provision = délit (article 401 Federal Penal
Code). Le statut `bounced` déclenche workflow de mise en demeure (hors scope
de cette table).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    DECIMAL,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class PdcCheque(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Chèque post-daté UAE."""

    __tablename__ = "pdc_cheques"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Référence interne lisible (ex : "PDC-2026-001847")
    reference: Mapped[str] = mapped_column(String(50), nullable=False)

    # Lien transactionnel : exactement l'un des deux est renseigné
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

    # Émetteur (locataire / acheteur — party umbrella)
    drawer_party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Données du chèque
    cheque_number: Mapped[str] = mapped_column(String(50), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(150), nullable=False)
    bank_branch: Mapped[str | None] = mapped_column(String(150), nullable=True)
    account_holder_name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount_aed: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False)

    # Calendrier
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    deposit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bounced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Cycle de vie
    # pending | deposited | cleared | bounced | replaced | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    # Motif si bounced (NSF, account closed, signature mismatch, stop payment…)
    bounce_reason: Mapped[str | None] = mapped_column(String(150), nullable=True)
    bounce_fee_aed: Mapped[Decimal] = mapped_column(DECIMAL(15, 2), nullable=False, default=0)

    # Chaîne de remplacement : PDC qui remplace celui-ci
    replaced_by_pdc_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pdc_cheques.id", ondelete="SET NULL"),
        nullable=True,
    )

    # OCR / scan
    document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ocr_data = mapped_column(JSONB, nullable=False, default=dict)
    ocr_confidence: Mapped[Decimal | None] = mapped_column(DECIMAL(5, 2), nullable=True)

    # Notes / suivi interne
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Workflow de mise en demeure (compteur d'alertes envoyées au drawer)
    legal_notices_sent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("idx_pdc_company", "company_id"),
        Index("idx_pdc_status", "status"),
        Index("idx_pdc_due_date", "due_date"),
        Index("idx_pdc_drawer", "drawer_party_id"),
    )
