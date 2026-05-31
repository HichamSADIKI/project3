"""Schémas Pydantic v2 — Workflow Engine (Phase 5)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

VALID_TYPES = ("quote_approval", "sla_escalation", "contract_approval", "custom")
VALID_INST_ST = ("in_progress", "approved", "rejected", "cancelled")
VALID_STEP_ST = ("pending", "in_progress", "approved", "rejected", "skipped", "escalated")
VALID_EV_TYPES = ("approve", "reject", "note", "escalate", "start", "complete", "cancel")


# ── Templates ─────────────────────────────────────────────────────────────


class StepDef(BaseModel):
    """Définition d'un step dans un template (JSONB)."""

    order: int
    name: str
    step_type: str = Field(..., pattern="^(approval|notification|auto|escalation)$")
    actor_role: str | None = None
    sla_hours: int | None = None


class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    workflow_type: str = Field(
        ..., pattern="^(quote_approval|sla_escalation|contract_approval|custom)$"
    )
    description: str | None = None
    steps_definition: list[StepDef] = Field(default_factory=list)


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    workflow_type: str
    description: str | None
    steps_definition: list[Any]
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Instances ─────────────────────────────────────────────────────────────


class InstanceCreate(BaseModel):
    template_id: uuid.UUID
    maintenance_ticket_id: uuid.UUID | None = None
    maintenance_quote_id: uuid.UUID | None = None
    contract_id: uuid.UUID | None = None


class StepOut(BaseModel):
    id: uuid.UUID
    step_order: int
    name: str
    step_type: str
    status: str
    actor_user_id: uuid.UUID | None
    actor_role: str | None
    sla_due_at: datetime | None
    completed_at: datetime | None
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


class InstanceOut(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    maintenance_ticket_id: uuid.UUID | None
    maintenance_quote_id: uuid.UUID | None
    contract_id: uuid.UUID | None
    status: str
    started_by: uuid.UUID
    completed_at: datetime | None
    created_at: datetime
    steps: list[StepOut] = []

    model_config = ConfigDict(from_attributes=True)


class InstanceListOut(BaseModel):
    success: bool = True
    data: list[InstanceOut]
    meta: dict[str, Any]


class InstanceDetailOut(BaseModel):
    success: bool = True
    data: InstanceOut


# ── Actions sur step ──────────────────────────────────────────────────────


class StepAction(BaseModel):
    comment: str | None = Field(None, max_length=2000)


# ── Events ────────────────────────────────────────────────────────────────


class EventOut(BaseModel):
    id: uuid.UUID
    instance_id: uuid.UUID
    step_id: uuid.UUID | None
    actor_user_id: uuid.UUID | None
    event_type: str
    comment: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
