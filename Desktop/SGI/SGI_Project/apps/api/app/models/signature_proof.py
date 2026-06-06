"""SignatureProofRecord — preuve de signature qualifiée persistée (Infinity ID).

Stocke une preuve produite par ``app.core.infinity_signature`` : empreinte du
document, identité signataire (+ niveau d'assurance), horodatage et sceau HMAC.
Permet la vérification a posteriori (non‑répudiation). Loi 1 : ``company_id`` + RLS.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class SignatureProofRecord(Base, TimestampMixin, TenantMixin):
    """Preuve de signature scellée et persistée. Loi 1 (RLS)."""

    __tablename__ = "signature_proofs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    signer_subject_type: Mapped[str] = mapped_column(String(20), nullable=False)  # user | client
    signer_subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    document_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    qualified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    signer_level: Mapped[str] = mapped_column(String(2), nullable=False)
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Sceau HMAC‑SHA256 (hex) du payload canonique — authenticité/intégrité.
    signature: Mapped[str] = mapped_column(String(64), nullable=False)

    __table_args__ = (
        Index("idx_signature_proofs_company", "company_id"),
        Index("idx_signature_proofs_document", "company_id", "document_sha256"),
    )
