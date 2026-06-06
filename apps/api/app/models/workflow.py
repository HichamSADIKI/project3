"""
Modèles Workflow Engine SGI (Phase 5).

Architecture :
- WorkflowTemplate  : modèle réutilisable (steps définis en JSONB).
- WorkflowInstance  : occurrence d'un template sur un objet métier.
- WorkflowStep      : étape d'une instance (approval, notification, escalation, auto).
- WorkflowEvent     : journal immuable des actions (approbation, rejet, note, escalade).

Un template définit un schéma de steps ; une instance l'applique à un objet
métier concret (ticket, devis, contrat…). Chaque step a un SLA : si dépassé,
Celery beat déclenche une escalade automatique.

Loi 1 : company_id NOT NULL + RLS sur les 4 tables (migration 0016).
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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


class WorkflowTemplate(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Modèle de workflow réutilisable.

    `steps_definition` (JSONB) : liste ordonnée de steps :
    [{"order": 1, "name": "approval", "type": "approval",
      "actor_role": "manager", "sla_hours": 24}, ...]

    Types de step :
      approval    — attend approbation/rejet d'un acteur humain
      notification— pousse une notification sans bloquer le flux
      auto        — transition automatique (déclenchée par Celery)
      escalation  — remonte à un supérieur hiérarchique
    """

    __tablename__ = "workflow_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # quote_approval | sla_escalation | contract_approval | custom
    workflow_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_definition = mapped_column(JSONB, nullable=False, default=list)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint(
            "workflow_type IN ('quote_approval','sla_escalation','contract_approval','custom')",
            name="ck_wf_template_type",
        ),
        Index("idx_wf_templates_company_type", "company_id", "workflow_type"),
    )


class WorkflowInstance(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Instance d'un template sur un objet métier."""

    __tablename__ = "workflow_instances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_templates.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # Objet métier concerné — un seul renseigné à la fois.
    maintenance_ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("maintenance_tickets.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    maintenance_quote_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("maintenance_quotes.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    # pending | in_progress | approved | rejected | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="in_progress")
    started_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress','approved','rejected','cancelled')",
            name="ck_wf_instance_status",
        ),
        Index("idx_wf_instances_company_status", "company_id", "status"),
        Index("idx_wf_instances_template", "template_id"),
    )


class WorkflowStep(Base, TimestampMixin, TenantMixin):
    """Étape concrète d'une instance de workflow."""

    __tablename__ = "workflow_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # approval | notification | auto | escalation
    step_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # pending | in_progress | approved | rejected | skipped | escalated
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    actor_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    sla_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "step_type IN ('approval','notification','auto','escalation')",
            name="ck_wf_step_type",
        ),
        CheckConstraint(
            "status IN ('pending','in_progress','approved','rejected','skipped','escalated')",
            name="ck_wf_step_status",
        ),
        Index("idx_wf_steps_company", "company_id"),
        Index("idx_wf_steps_instance", "instance_id", "step_order"),
        Index("idx_wf_steps_sla", "sla_due_at"),
    )


class WorkflowEvent(Base, TenantMixin):
    """Journal immuable des actions sur un workflow (pas de soft delete)."""

    __tablename__ = "workflow_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_steps.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    # approve | reject | note | escalate | start | complete | cancel
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('approve','reject','note','escalate','start','complete','cancel')",
            name="ck_wf_event_type",
        ),
        Index("idx_wf_events_company", "company_id"),
        Index("idx_wf_events_instance", "instance_id", "created_at"),
    )
