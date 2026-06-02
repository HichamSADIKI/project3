"""Schémas Pydantic v2 — Omnichannel Inbox (Ph2 API REST)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Messages ──────────────────────────────────────────────────────────────


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    direction: str
    channel: str
    external_message_id: str | None
    sender_user_id: uuid.UUID | None
    body: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    """Réponse sortante d'un agent dans une conversation."""

    body: str = Field(..., min_length=1, max_length=10000)


# ── Notes internes ──────────────────────────────────────────────────────────


class NoteOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    agent_user_id: uuid.UUID | None
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class NoteCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


# ── Tags ─────────────────────────────────────────────────────────────────


class TagOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str | None

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str | None = Field(None, max_length=20)


class TagAttach(BaseModel):
    """Attache un tag à une conversation, par id (existant) OU par nom (créé si besoin)."""

    tag_id: uuid.UUID | None = None
    name: str | None = Field(None, min_length=1, max_length=50)


# ── Conversations ──────────────────────────────────────────────────────────


class ConversationOut(BaseModel):
    id: uuid.UUID
    reference: str
    channel: str
    external_thread_id: str | None
    client_id: uuid.UUID | None
    assigned_agent_id: uuid.UUID | None
    status: str
    subject: str | None
    contact_display: str | None
    last_message_at: datetime | None
    response_due_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationOut):
    """Détail enrichi : messages + notes + tags."""

    messages: list[MessageOut] = Field(default_factory=list)
    notes: list[NoteOut] = Field(default_factory=list)
    tags: list[TagOut] = Field(default_factory=list)


class AssignBody(BaseModel):
    # Optionnel : si absent → auto-attribution à l'agent courant (issu du JWT).
    agent_user_id: uuid.UUID | None = None


class StatusBody(BaseModel):
    status: Literal["new", "assigned", "pending", "resolved", "closed"]


# ── Enveloppes standard {success, data, meta} ──────────────────────────────


class ConversationListOut(BaseModel):
    success: bool = True
    data: list[ConversationOut]
    meta: dict[str, Any]


class ConversationDetailOut(BaseModel):
    success: bool = True
    data: ConversationDetail


class ConversationItemOut(BaseModel):
    success: bool = True
    data: ConversationOut


class MessageItemOut(BaseModel):
    success: bool = True
    data: MessageOut


class NoteItemOut(BaseModel):
    success: bool = True
    data: NoteOut


class TagItemOut(BaseModel):
    success: bool = True
    data: TagOut


class TagListOut(BaseModel):
    success: bool = True
    data: list[TagOut]
