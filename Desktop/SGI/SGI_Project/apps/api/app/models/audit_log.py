import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    """
    Journal d'audit immuable — toutes les actions sensibles du système.
    Table exemptée de RLS (pas de TenantMixin) mais company_id est indexé.
    Pas de SoftDelete ni de TimestampMixin : created_at est défini manuellement
    et les logs ne sont jamais modifiés ni supprimés.
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Tenant (indexé mais sans RLS)
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    # Auteur de l'action
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Action et ressource cible
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Diff des champs modifiés : {field: {old: ..., new: ...}}
    changes = mapped_column(JSONB, nullable=False, default=dict)

    # Contexte réseau
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Horodatage (colonne unique — pas de updated_at sur un log immuable)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Facilite les requêtes d'audit par tenant + ressource
        Index("idx_audit_logs_company_resource", "company_id", "resource"),
        Index("idx_audit_logs_company_action", "company_id", "action"),
    )
