"""
DocumentSignature — signature électronique d'une version de document.

Approche interne conforme à la *UAE Federal Decree-Law 46/2021 on Electronic
Transactions* : on capture l'identité du signataire, son intention, l'empreinte
exacte de la version signée (`signature_hash`), et une piste d'audit
(IP / user-agent / horodatage). Le champ `provider` reste "internal" mais
permet de brancher un prestataire externe (DocuSign…) ultérieurement.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class DocumentSignature(Base, TimestampMixin, TenantMixin):
    """Signature électronique d'une version. Loi 1 (RLS)."""

    __tablename__ = "document_signatures"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # On signe une version PRÉCISE (immuable).
    document_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Signataire : externe (client) ou interne (user). Au moins un identifiant
    # OU un nom libre.
    signer_party_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
    )
    signer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    signer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    signer_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # owner | tenant | agent | witness | other
    signer_role: Mapped[str] = mapped_column(String(20), nullable=False, default="other")

    # pending | signed | declined | expired
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    # Preuve : SHA256(sha256_version + identité signataire + horodatage ISO)
    signature_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # otp | typed | drawn | click_to_sign
    method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    otp_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="internal")

    # Piste d'audit de l'acte de signature (preuve légale)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Ordre de signature (multi-parties séquentiel)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    declined_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("idx_doc_sign_company", "company_id"),
        Index("idx_doc_sign_document", "document_id"),
        Index("idx_doc_sign_company_status", "company_id", "status"),
    )
