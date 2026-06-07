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


# ── Assistant in-app (chat conversationnel) ───────────────────────────────


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    # Historique éphémère envoyé par le front (ordre chronologique). Borné pour
    # éviter d'injecter un contexte démesuré dans l'appel Gemini.
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    locale: Literal["ar", "en", "fr"] = "fr"
    # Écran courant (clé de nav front) — contexte facultatif pour situer l'aide.
    screen: str | None = Field(default=None, max_length=60)


class NavSuggestion(BaseModel):
    screen: str
    label: str


class ChatPrefill(BaseModel):
    """Action guidée profonde : écran cible + champs à pré-remplir."""

    screen: str
    fields: dict[str, str | int] = Field(default_factory=dict)


class ChatData(BaseModel):
    reply: str
    engine: str
    suggested_navigation: list[NavSuggestion] = Field(default_factory=list)
    prefill: ChatPrefill | None = None


class ChatOut(BaseModel):
    success: bool = True
    data: ChatData
