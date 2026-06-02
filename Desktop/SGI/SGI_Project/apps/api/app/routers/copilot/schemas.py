"""Schémas Pydantic v2 — AI Copilot (assistance agent)."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class AssistRequest(BaseModel):
    context_type: Literal["inbox", "ticket"]
    context_id: uuid.UUID
    locale: Literal["ar", "en", "fr"] = "fr"


class AssistData(BaseModel):
    context_type: Literal["inbox", "ticket"]
    context_id: uuid.UUID
    channel: str
    summary: str
    suggested_reply: str
    sentiment: Literal["positive", "neutral", "negative"]
    intent: str
    next_best_actions: list[str] = Field(default_factory=list)
    engine: str


class AssistOut(BaseModel):
    success: bool = True
    data: AssistData


class AssistQueuedData(BaseModel):
    status: Literal["queued"] = "queued"
    context_type: Literal["inbox", "ticket"]
    context_id: uuid.UUID


class AssistQueuedOut(BaseModel):
    success: bool = True
    data: AssistQueuedData
