"""Schémas Pydantic v2 — Agent AI Clients (sous-module `clients/ai`).

Entrées/sorties des endpoints `POST /clients/ai/...` : insights portefeuille,
scoring/qualification d'un client, brouillon de message multilingue et chat
conversationnel scopé au portefeuille clients. Tout reste scopé `company_id`
côté service (Loi 1) ; ces schémas ne portent jamais de tenant fourni client.
"""

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

Locale = Literal["ar", "en", "fr"]


# ── Scoring / qualification d'un client ───────────────────────────────────


class ClientScoreData(BaseModel):
    client_id: uuid.UUID
    score: int = Field(ge=0, le=100)
    band: Literal["hot", "warm", "cold"]
    golden_visa_eligible: bool
    reasons: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    narrative: str
    engine: str


class ClientScoreOut(BaseModel):
    success: bool = True
    data: ClientScoreData


# ── Insights portefeuille ─────────────────────────────────────────────────


class ClientInsightsData(BaseModel):
    total: int
    headline: str
    bullets: list[str] = Field(default_factory=list)
    golden_visa_budget_count: int
    by_type: dict[str, int] = Field(default_factory=dict)
    by_source: dict[str, int] = Field(default_factory=dict)
    narrative: str
    engine: str


class ClientInsightsOut(BaseModel):
    success: bool = True
    data: ClientInsightsData


# ── Brouillon de message (email / WhatsApp) ───────────────────────────────


class ClientMessageRequest(BaseModel):
    channel: Literal["email", "whatsapp"] = "whatsapp"
    locale: Locale = "fr"
    purpose: Literal["follow_up", "proposal", "welcome", "visit"] = "follow_up"


class ClientMessageData(BaseModel):
    client_id: uuid.UUID
    channel: str
    locale: str
    purpose: str
    message: str
    engine: str


class ClientMessageOut(BaseModel):
    success: bool = True
    data: ClientMessageData


# ── Chat conversationnel scopé clients ────────────────────────────────────


class AiChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ClientChatRequest(BaseModel):
    messages: list[AiChatMessage] = Field(min_length=1, max_length=20)
    locale: Locale = "fr"


class ClientChatData(BaseModel):
    reply: str
    engine: str
    context: dict[str, Any] = Field(default_factory=dict)


class ClientChatOut(BaseModel):
    success: bool = True
    data: ClientChatData
