"""Modèle SQLAlchemy — Sources (migration 0037).

`source_imports` : registre d'idempotence / provenance / rejets de chaque
enregistrement source ingéré. La cible métier reste `CRMLead` (réutilisation) ;
cette table ne duplique pas les leads, elle trace l'ingestion.

RLS via company_id (Loi 1). Timestamps timezone-aware. Soft-delete par cohérence.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class SourceImport(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Trace d'un enregistrement ingéré depuis une source externe. RLS via company_id."""

    __tablename__ = "source_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    # Catégorie de source — aligné EXACTEMENT sur le CHECK (migration 0037).
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Canal précis (ex. 'csv', 'webhook:facebook', 'api:portal', 'watcher:bayut').
    source_channel: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Identifiant natif de la source = clé d'idempotence (avec source_type).
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Empreinte normalisée email|phone (dédup client).
    dedup_key: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    # Statut de l'ingestion — aligné EXACTEMENT sur le CHECK (migration 0037).
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="imported")
    reject_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True
    )
    created_client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    # Audit de provenance (payload brut reçu).
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
