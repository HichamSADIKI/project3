"""
Document — document logique générique, attachable à n'importe quelle entité.

Module documentaire transverse : un contrat, un bâtiment, une unité, un
propriétaire, un locataire… peut porter des documents. Le lien est polymorphe
(`entity_type` + `entity_id`, validé applicativement) pour éviter une FK dure
par entité. Le fichier réel vit dans `document_versions` (versioning immuable) ;
`current_version_id` pointe vers la dernière version.
"""
import uuid

from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Document(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Document logique. Loi 1 (RLS)."""

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)

    # contract | mandate | id | passport | ejari | dld | insurance | invoice
    # | statement | other
    doc_type: Mapped[str] = mapped_column(String(30), nullable=False, default="other")

    # Lien polymorphe vers l'entité propriétaire (pas de FK dure).
    entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # draft | active | signed | archived
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")

    # Pointe vers la dernière version (géré applicativement, pas de FK dure
    # pour éviter la dépendance circulaire avec document_versions).
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags = mapped_column(JSONB, nullable=False, default=list)

    __table_args__ = (
        Index("idx_documents_company", "company_id"),
        Index("idx_documents_entity", "company_id", "entity_type", "entity_id"),
        Index("idx_documents_company_type", "company_id", "doc_type"),
        Index("idx_documents_company_status", "company_id", "status"),
    )
