"""Schémas Pydantic v2 — Marketing.

Campagnes de diffusion (canal, période, métriques) + boucle de retour leads.
Montants AED en Decimal(ge=0). Enveloppes standard {success, data, meta}.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

# Canaux & statuts — alignés EXACTEMENT sur le service + le CHECK (migration 0036).
ChannelLiteral = Literal[
    "social_facebook",
    "social_instagram",
    "social_linkedin",
    "portal_bayut",
    "portal_propertyfinder",
    "portal_dubizzle",
    "email",
    "other",
]
StatusLiteral = Literal["draft", "scheduled", "active", "paused", "completed", "cancelled"]


# ── Campagnes ──────────────────────────────────────────────────────────────


class CampaignOut(BaseModel):
    id: uuid.UUID
    reference: str
    name: str
    channel: str
    status: str
    starts_on: date | None
    ends_on: date | None
    budget_aed: Decimal | None
    spend_aed: Decimal
    impressions: int
    clicks: int
    leads_count: int
    published_at: datetime | None
    external_ref: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    channel: ChannelLiteral
    starts_on: date | None = None
    ends_on: date | None = None
    budget_aed: Decimal | None = Field(None, ge=0)
    notes: str | None = Field(None, max_length=10000)


class CampaignUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    starts_on: date | None = None
    ends_on: date | None = None
    budget_aed: Decimal | None = Field(None, ge=0)
    spend_aed: Decimal | None = Field(None, ge=0)
    notes: str | None = Field(None, max_length=10000)


class CampaignTransitionBody(BaseModel):
    status: StatusLiteral


# ── Unités liées ─────────────────────────────────────────────────────────────


class CampaignUnitOut(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    unit_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AttachUnitsBody(BaseModel):
    unit_ids: list[uuid.UUID] = Field(..., min_length=1)


# ── Boucle de retour leads ─────────────────────────────────────────────────


class InboundContact(BaseModel):
    name: str | None = Field(None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)


class InboundLeadBody(BaseModel):
    client_id: uuid.UUID | None = None
    contact: InboundContact = Field(default_factory=InboundContact)
    message: str | None = Field(None, max_length=10000)
    budget: Decimal | None = Field(None, ge=0)


class InboundLeadResult(BaseModel):
    lead_id: uuid.UUID
    client_id: uuid.UUID
    reference: str
    score: int
    source: str
    leads_count: int


# ── KPIs ──────────────────────────────────────────────────────────────────


class KpisOut(BaseModel):
    total_campaigns: int
    by_status: dict[str, int]
    impressions: int
    clicks: int
    leads: int
    spend_aed: Decimal


# ── Enveloppes standard {success, data, meta} ──────────────────────────────


class CampaignListOut(BaseModel):
    success: bool = True
    data: list[CampaignOut]
    meta: dict[str, Any]


class CampaignItemOut(BaseModel):
    success: bool = True
    data: CampaignOut


class CampaignUnitListOut(BaseModel):
    success: bool = True
    data: list[CampaignUnitOut]
    meta: dict[str, Any]


class CampaignUnitItemOut(BaseModel):
    success: bool = True
    data: CampaignUnitOut


class InboundLeadItemOut(BaseModel):
    success: bool = True
    data: InboundLeadResult


class KpisItemOut(BaseModel):
    success: bool = True
    data: KpisOut
