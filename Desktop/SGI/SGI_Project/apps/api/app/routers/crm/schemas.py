"""Schémas Pydantic v2 pour le module CRM."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Statuts valides du pipeline CRM (CLAUDE.md)
# ---------------------------------------------------------------------------
VALID_STATUSES = (
    "new",
    "contacted",
    "qualified",
    "proposal_sent",
    "visit_planned",
    "visit_done",
    "negotiation",
    "won",
    "lost",
)

STATUS_PATTERN = (
    "^(new|contacted|qualified|proposal_sent|visit_planned|visit_done|negotiation|won|lost)$"
)

ACTIVITY_TYPE_PATTERN = "^(call|email|whatsapp|visit|note|status_change)$"


# ---------------------------------------------------------------------------
# Lead schemas
# ---------------------------------------------------------------------------


class LeadCreate(BaseModel):
    client_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    source: str | None = Field(None, max_length=50)
    budget: Decimal | None = Field(None, gt=0, decimal_places=2)
    property_type: str | None = Field(None, max_length=50)
    preferred_location: str | None = Field(None, max_length=150)
    preferred_property_id: uuid.UUID | None = None
    golden_visa_eligible: bool = False
    notes: str | None = None


class LeadUpdate(BaseModel):
    agent_id: uuid.UUID | None = None
    source: str | None = Field(None, max_length=50)
    budget: Decimal | None = Field(None, gt=0, decimal_places=2)
    property_type: str | None = Field(None, max_length=50)
    preferred_location: str | None = Field(None, max_length=150)
    preferred_property_id: uuid.UUID | None = None
    golden_visa_eligible: bool | None = None
    notes: str | None = None
    next_action_at: datetime | None = None
    next_action_type: str | None = Field(None, max_length=50)


class LeadStatusUpdate(BaseModel):
    status: str = Field(..., pattern=STATUS_PATTERN)
    reason: str | None = Field(
        None,
        max_length=150,
        description="Obligatoire si status='lost'",
    )
    won_amount: Decimal | None = Field(
        None,
        gt=0,
        description="Montant de la vente si status='won'",
    )


# ---------------------------------------------------------------------------
# Activity schemas
# ---------------------------------------------------------------------------


class ActivityCreate(BaseModel):
    lead_id: uuid.UUID
    type: str = Field(..., pattern=ACTIVITY_TYPE_PATTERN)
    content: str | None = None
    scheduled_at: datetime | None = None


# ---------------------------------------------------------------------------
# Output schemas
# ---------------------------------------------------------------------------


class LeadOut(BaseModel):
    id: uuid.UUID
    reference: str | None = None
    client_id: uuid.UUID
    client_name: str | None = None
    agent_id: uuid.UUID | None
    status: str
    category: str
    source: str | None
    budget: Decimal | None
    property_type: str | None
    preferred_location: str | None
    preferred_property_id: uuid.UUID | None
    golden_visa_eligible: bool
    score: int
    response_rate: Decimal
    contact_attempts: int
    last_contact_at: datetime | None
    next_action_at: datetime | None
    next_action_type: str | None
    lost_reason: str | None
    won_amount: Decimal | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ActivityOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    user_id: uuid.UUID
    type: str
    content: str | None
    status_from: str | None
    status_to: str | None
    scheduled_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadListOut(BaseModel):
    success: bool = True
    data: list[LeadOut]
    meta: dict[str, Any]


class LeadDetailOut(BaseModel):
    success: bool = True
    data: LeadOut


class ActivityListOut(BaseModel):
    success: bool = True
    data: list[ActivityOut]
    meta: dict[str, Any]


class PipelineKPIOut(BaseModel):
    success: bool = True
    data: dict[str, int]
