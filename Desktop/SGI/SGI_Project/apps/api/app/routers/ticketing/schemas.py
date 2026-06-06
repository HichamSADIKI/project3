"""Schémas Pydantic v2 — Ticketing SLA (Ph2 API REST)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Événements de timeline ───────────────────────────────────────────────────


class EventOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    event_type: str
    actor_user_id: uuid.UUID | None
    body: str | None
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Tickets ──────────────────────────────────────────────────────────────────


class TicketOut(BaseModel):
    id: uuid.UUID
    reference: str
    subject: str
    description: str | None
    category: str | None
    priority: str
    status: str
    requester_client_id: uuid.UUID | None
    assigned_agent_id: uuid.UUID | None
    sla_due_at: datetime | None
    first_response_at: datetime | None
    resolved_at: datetime | None
    escalation_level: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketDetail(TicketOut):
    """Détail enrichi : ticket + timeline d'événements."""

    events: list[EventOut] = Field(default_factory=list)


class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=10000)
    category: str | None = Field(None, max_length=50)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    requester_client_id: uuid.UUID | None = None


class AssignBody(BaseModel):
    # Optionnel : si absent → auto-attribution à l'agent courant (issu du JWT).
    agent_user_id: uuid.UUID | None = None


class TransitionBody(BaseModel):
    status: Literal["open", "in_progress", "pending", "resolved", "closed"]


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000)


# ── Enveloppes standard {success, data, meta} ──────────────────────────────


class TicketListOut(BaseModel):
    success: bool = True
    data: list[TicketOut]
    meta: dict[str, Any]


class TicketDetailOut(BaseModel):
    success: bool = True
    data: TicketDetail


class TicketItemOut(BaseModel):
    success: bool = True
    data: TicketOut


class EventItemOut(BaseModel):
    success: bool = True
    data: EventOut


class TicketsSummary(BaseModel):
    by_status: dict[str, int]
    open_count: int
    by_priority: dict[str, int]
    sla_breached_count: int


class TicketsSummaryOut(BaseModel):
    success: bool = True
    data: TicketsSummary
    meta: dict[str, Any]
