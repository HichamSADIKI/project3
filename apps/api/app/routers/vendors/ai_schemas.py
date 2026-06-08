"""Schémas Pydantic v2 — Agent AI Fournisseurs (sous-module `vendors/ai`).

Entrées/sorties de `POST /vendors/ai/...` : synthèse du parc, score de
fiabilité/risque d'un fournisseur, aide à la validation d'une inscription
portail et chat scopé au parc fournisseurs. Scoping `company_id` côté service
(Loi 1) — jamais de tenant fourni par le client.
"""

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

Locale = Literal["ar", "en", "fr"]


# ── Score de fiabilité / risque ───────────────────────────────────────────


class VendorRiskData(BaseModel):
    party_id: uuid.UUID
    score: int = Field(ge=0, le=100, description="Score de fiabilité (100 = idéal)")
    risk_band: Literal["low", "medium", "high"]
    flags: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    narrative: str
    engine: str


class VendorRiskOut(BaseModel):
    success: bool = True
    data: VendorRiskData


# ── Aide à la validation d'inscription ────────────────────────────────────


class VendorValidationData(BaseModel):
    party_id: uuid.UUID
    recommendation: Literal["approve", "request_documents", "review", "reject"]
    blocking_issues: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    narrative: str
    engine: str


class VendorValidationOut(BaseModel):
    success: bool = True
    data: VendorValidationData


# ── Insights parc fournisseurs ────────────────────────────────────────────


class VendorInsightsData(BaseModel):
    total: int
    headline: str
    bullets: list[str] = Field(default_factory=list)
    active_count: int
    verified_count: int
    by_type: dict[str, int] = Field(default_factory=dict)
    by_verification: dict[str, int] = Field(default_factory=dict)
    narrative: str
    engine: str


class VendorInsightsOut(BaseModel):
    success: bool = True
    data: VendorInsightsData


# ── Chat conversationnel scopé fournisseurs ───────────────────────────────


class AiChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class VendorChatRequest(BaseModel):
    messages: list[AiChatMessage] = Field(min_length=1, max_length=20)
    locale: Locale = "fr"


class VendorChatData(BaseModel):
    reply: str
    engine: str
    context: dict[str, Any] = Field(default_factory=dict)


class VendorChatOut(BaseModel):
    success: bool = True
    data: VendorChatData


# ── Message d'outreach fournisseur (brouillon + envoi) — parité Clients ────

VendorPurpose = Literal["request_documents", "performance_review", "welcome", "follow_up"]


class VendorMessageRequest(BaseModel):
    channel: Literal["email", "whatsapp"] = "email"
    locale: Locale = "fr"
    purpose: VendorPurpose = "request_documents"


class VendorMessageData(BaseModel):
    party_id: uuid.UUID
    channel: str
    locale: str
    purpose: str
    message: str
    engine: str


class VendorMessageOut(BaseModel):
    success: bool = True
    data: VendorMessageData


class VendorSendMessageRequest(BaseModel):
    channel: Literal["email", "whatsapp"] = "email"
    locale: Locale = "fr"
    purpose: VendorPurpose = "request_documents"
    message: str | None = Field(default=None, max_length=4000)


class VendorSendData(BaseModel):
    status: Literal["queued", "template_required", "no_recipient"]
    channel: str
    notification_id: uuid.UUID | None = None
    detail: str | None = None


class VendorSendOut(BaseModel):
    success: bool = True
    data: VendorSendData
