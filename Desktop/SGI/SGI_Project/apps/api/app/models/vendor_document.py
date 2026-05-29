"""VendorDocument — pièce KYC d'un fournisseur prestataire (licence, assurance…).

Rattaché à `vendors.party_id`. Chemin MinIO + expiration + extraction OCR.
"""
import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class VendorDocument(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    __tablename__ = "vendor_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    vendor_party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.party_id", ondelete="CASCADE"),
        nullable=False,
    )
    # trade_licence | insurance | vat | id | other
    doc_type: Mapped[str] = mapped_column(String(30), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    extracted = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    # active | expired | replaced
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )

    __table_args__ = (
        CheckConstraint(
            "doc_type IN ('trade_licence','insurance','vat','id','other')",
            name="ck_vendor_documents_type",
        ),
        CheckConstraint(
            "status IN ('active','expired','replaced')",
            name="ck_vendor_documents_status",
        ),
        Index("idx_vendor_documents_company", "company_id"),
        Index("idx_vendor_documents_vendor", "vendor_party_id"),
        Index("idx_vendor_documents_type", "doc_type"),
    )
