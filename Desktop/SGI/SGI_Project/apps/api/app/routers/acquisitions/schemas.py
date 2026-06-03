"""Schémas Pydantic v2 — Acquisitions (mandats d'achat + offres + matching)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Mandats d'achat ──────────────────────────────────────────────────────────


class MandateOut(BaseModel):
    id: uuid.UUID
    reference: str
    buyer_client_id: uuid.UUID
    status: str
    budget_min: Decimal | None
    budget_max: Decimal | None
    property_type: str | None
    bedrooms_min: int | None
    search_radius_m: int | None
    notes: str | None
    signed_at: datetime | None
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MandateCreate(BaseModel):
    buyer_client_id: uuid.UUID
    budget_min: Decimal | None = Field(None, ge=0)
    budget_max: Decimal | None = Field(None, ge=0)
    property_type: str | None = Field(None, max_length=30)
    bedrooms_min: int | None = Field(None, ge=0)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    search_radius_m: int | None = Field(None, ge=0)
    notes: str | None = Field(None, max_length=10000)
    signed_at: datetime | None = None
    expires_at: datetime | None = None


class MandateTransitionBody(BaseModel):
    status: Literal["active", "fulfilled", "expired", "cancelled"]


# ── Offres d'achat ───────────────────────────────────────────────────────────


class OfferOut(BaseModel):
    id: uuid.UUID
    reference: str
    mandate_id: uuid.UUID
    property_id: uuid.UUID
    amount: Decimal
    status: str
    submitted_at: datetime | None
    decided_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OfferCreate(BaseModel):
    mandate_id: uuid.UUID
    property_id: uuid.UUID
    amount: Decimal = Field(..., gt=0)
    notes: str | None = Field(None, max_length=10000)


class OfferTransitionBody(BaseModel):
    status: Literal["draft", "submitted", "accepted", "rejected", "withdrawn"]


# ── Enveloppes standard {success, data, meta} ──────────────────────────────


class MandateListOut(BaseModel):
    success: bool = True
    data: list[MandateOut]
    meta: dict[str, Any]


class MandateItemOut(BaseModel):
    success: bool = True
    data: MandateOut


class OfferListOut(BaseModel):
    success: bool = True
    data: list[OfferOut]
    meta: dict[str, Any]


class OfferItemOut(BaseModel):
    success: bool = True
    data: OfferOut


class MatchListOut(BaseModel):
    """Liste de biens scorés par le moteur de rapprochement.

    `data` reste un dict libre par bien (colonnes du bien + `dist_m` +
    `match_score`) — pas de modèle figé pour ne pas dupliquer le schéma Property.
    """

    success: bool = True
    data: list[dict[str, Any]]
    meta: dict[str, Any]
