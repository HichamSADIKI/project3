"""Modèles SQLAlchemy — Console d'administration (socle Phase 1).

Deux périmètres étanches (cf. migration 0048) :

- **App-admin** (tenant, Loi 1 — héritent de TenantMixin → company_id + RLS) :
  `AlertRule`, `AlertEvent`.
- **Infra-admin** (PLATEFORME, cross-tenant — PAS de TenantMixin, PAS de company_id ;
  exception Loi 1 gardée par `require_platform_admin`) : `InfraService`, `InfraAction`,
  `BackupRun`.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DECIMAL,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin

# ════════════════════════════════════════════════════════════════════════════
# PÉRIMÈTRE A — App-admin (tenant, Loi 1)
# ════════════════════════════════════════════════════════════════════════════


class AlertRule(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Règle de seuil/alerte par société (préventif, Phase 2 pour l'évaluation)."""

    __tablename__ = "admin_alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    metric: Mapped[str] = mapped_column(String(120), nullable=False)
    comparator: Mapped[str] = mapped_column(String(4), nullable=False)  # gt|lt|gte|lte
    threshold: Mapped[Decimal] = mapped_column(DECIMAL(18, 4), nullable=False)
    window_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="warning")
    channel: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class AlertEvent(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Alerte déclenchée. Machine à états open → acked → resolved."""

    __tablename__ = "admin_alert_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_alert_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    observed_value: Mapped[Decimal | None] = mapped_column(DECIMAL(18, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    acked_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ════════════════════════════════════════════════════════════════════════════
# PÉRIMÈTRE B — Infra-admin (PLATEFORME, cross-tenant, PAS de company_id)
# ════════════════════════════════════════════════════════════════════════════


class InfraService(Base, TimestampMixin, SoftDeleteMixin):
    """Service supervisé/contrôlable (allowlist). Cross-tenant — pas de company_id."""

    __tablename__ = "infra_services"
    __table_args__ = (UniqueConstraint("name", name="uq_infra_services_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)  # container|db|cache|queue|proxy
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_known_state: Mapped[str | None] = mapped_column(String(40), nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_controllable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Nom du service Docker Compose (label com.docker.compose.service) — résolution
    # du conteneur par l'exécuteur D2. NULL si non pilotable.
    compose_service: Mapped[str | None] = mapped_column(String(120), nullable=True)


class InfraAction(Base):
    """Journal append-only des actions de contrôle (alimenté en Phase 3). Pas de company_id."""

    __tablename__ = "infra_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("infra_services.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # start|stop|restart|...
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested")
    detail: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BackupRun(Base):
    """Exécution de sauvegarde supervisée (DB/MinIO). Append-only, pas de company_id."""

    __tablename__ = "backup_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target: Mapped[str] = mapped_column(String(20), nullable=False)  # db|minio
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    location: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    error: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
