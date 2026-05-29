"""Schémas Pydantic v2 — module Communication (Phase 3)."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

VALID_TYPES  = ("direct", "group", "ticket", "contract")
VALID_KINDS  = ("text", "voice", "system")
VALID_ROLES  = ("admin", "member")
TYPE_PATTERN = "^(direct|group|ticket|contract)$"
KIND_PATTERN = "^(text|voice|system)$"


# ── Conversations ─────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    type: str = Field("direct", pattern=TYPE_PATTERN)
    subject: str | None = Field(None, max_length=255)
    participant_ids: list[uuid.UUID] = Field(
        ..., min_length=1, description="User IDs à ajouter comme participants"
    )
    maintenance_ticket_id: uuid.UUID | None = None
    contract_id: uuid.UUID | None = None


class ParticipantOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    last_read_at: datetime | None
    muted: bool

    model_config = ConfigDict(from_attributes=True)


class ConversationOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    type: str
    subject: str | None
    maintenance_ticket_id: uuid.UUID | None
    contract_id: uuid.UUID | None
    created_by: uuid.UUID
    last_message_at: datetime | None
    created_at: datetime
    participants: list[ParticipantOut] = []

    model_config = ConfigDict(from_attributes=True)


class ConversationListOut(BaseModel):
    success: bool = True
    data: list[ConversationOut]
    meta: dict[str, Any]


class ConversationDetailOut(BaseModel):
    success: bool = True
    data: ConversationOut


# ── Messages ──────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    body: str | None = Field(None, max_length=10000)
    kind: str = Field("text", pattern=KIND_PATTERN)
    reply_to_id: uuid.UUID | None = None
    mentioned_user_ids: list[uuid.UUID] = Field(default_factory=list)


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_user_id: uuid.UUID
    kind: str
    body: str | None
    attachment_key: str | None
    transcript: str | None
    reply_to_id: uuid.UUID | None
    created_at: datetime
    edited_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class MessageListOut(BaseModel):
    success: bool = True
    data: list[MessageOut]
    meta: dict[str, Any]


# ── Participants ──────────────────────────────────────────────────────────

class ParticipantAdd(BaseModel):
    user_id: uuid.UUID
    role: str = Field("member", pattern="^(admin|member)$")
