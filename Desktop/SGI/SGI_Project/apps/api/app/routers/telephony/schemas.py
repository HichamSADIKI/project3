"""Schémas Pydantic v2 — Téléphonie."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class CallCreate(BaseModel):
    """Création d'une entrée d'appel (log manuel ou amorce click-to-call)."""

    direction: Literal["inbound", "outbound", "internal"]
    from_number: str | None = Field(None, max_length=50)
    to_number: str | None = Field(None, max_length=50)
    client_id: uuid.UUID | None = None
    agent_extension: str | None = Field(None, max_length=20)
    queue: str | None = Field(None, max_length=50)
    recording_consent: bool = False
    notes: str | None = None


class CallTransition(BaseModel):
    status: Literal["answered", "completed", "missed", "busy", "no_answer", "failed", "cancelled"]
    hangup_cause: str | None = Field(None, max_length=50)


class CallNotesUpdate(BaseModel):
    """Mise à jour des notes de wrap-up (la disposition est encodée en 1re ligne)."""

    notes: str | None = None


class ClickToCall(BaseModel):
    """Originate : l'agent (extension) appelle un numéro / un client."""

    to_number: str = Field(..., max_length=50)
    client_id: uuid.UUID | None = None
    agent_extension: str | None = Field(
        None,
        max_length=20,
        description="Extension de l'agent ; défaut = celle de son agent_state.",
    )


class CallOut(BaseModel):
    id: uuid.UUID
    reference: str
    direction: str
    status: str
    from_number: str | None
    to_number: str | None
    agent_user_id: uuid.UUID | None
    agent_extension: str | None
    client_id: uuid.UUID | None
    queue: str | None
    recording_url: str | None
    recording_consent: bool
    started_at: datetime | None
    answered_at: datetime | None
    ended_at: datetime | None
    wait_seconds: int | None
    duration_seconds: int | None
    hangup_cause: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CallListOut(BaseModel):
    success: bool = True
    data: list[CallOut]
    meta: dict[str, Any]


class CallDetailOut(BaseModel):
    success: bool = True
    data: CallOut


# ── Agent ──────────────────────────────────────────────────────────────


class AgentStatusSet(BaseModel):
    status: Literal["offline", "available", "busy", "wrap_up", "paused"]
    extension: str | None = Field(None, max_length=20)


class AgentStateOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    extension: str | None
    status: str
    current_call_id: uuid.UUID | None
    last_changed_at: datetime | None

    model_config = {"from_attributes": True}


class AgentStateDetailOut(BaseModel):
    success: bool = True
    data: AgentStateOut


class AgentStateListOut(BaseModel):
    success: bool = True
    data: list[AgentStateOut]


# ── Screen pop ───────────────────────────────────────────────────────────


class PhoneLookupMatch(BaseModel):
    client_id: uuid.UUID
    display_name: str
    phone: str | None
    type: str


class PhoneLookupOut(BaseModel):
    success: bool = True
    data: list[PhoneLookupMatch]
