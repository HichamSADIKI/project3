"""
DocumentVersion — version immuable d'un document (append-only).

Chaque upload crée une nouvelle version (numérotée par document). Le fichier
réel est stocké dans MinIO (`file_path`). `sha256` garantit l'intégrité du
contenu et sert de base à la preuve de signature. Jamais modifiée ni supprimée.
"""
import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class DocumentVersion(Base, TimestampMixin, TenantMixin):
    """Version immuable d'un document. Loi 1 (RLS)."""

    __tablename__ = "document_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    version_number: Mapped[int] = mapped_column(Integer, nullable=False)

    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Empreinte SHA-256 du contenu (intégrité + base de preuve de signature)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)

    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_doc_versions_company", "company_id"),
        Index(
            "uq_doc_versions_doc_number",
            "document_id",
            "version_number",
            unique=True,
        ),
    )
