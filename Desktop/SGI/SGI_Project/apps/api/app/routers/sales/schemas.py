"""Schémas Pydantic v2 — module Vente (sales)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Mandats ──────────────────────────────────────────────────────────────────


class MandateOut(BaseModel):
    id: uuid.UUID
    reference: str
    seller_client_id: uuid.UUID
    property_id: uuid.UUID | None
    mandate_type: str
    commission_rate: Decimal
    asking_price: Decimal | None
    status: str
    signed_at: datetime | None
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MandateCreate(BaseModel):
    seller_client_id: uuid.UUID
    property_id: uuid.UUID | None = None
    mandate_type: Literal["exclusive", "simple", "open"] = "exclusive"
    commission_rate: Decimal = Field(default=Decimal("2.00"), ge=0, le=100)
    asking_price: Decimal | None = Field(default=None, ge=0)


class MandateTransition(BaseModel):
    status: Literal["sold", "expired", "cancelled"]


# ── Annonces ─────────────────────────────────────────────────────────────────


class ListingOut(BaseModel):
    id: uuid.UUID
    reference: str
    mandate_id: uuid.UUID
    title_ar: str | None
    title_en: str | None
    title_fr: str | None
    list_price: Decimal
    status: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ListingCreate(BaseModel):
    mandate_id: uuid.UUID
    list_price: Decimal = Field(..., ge=0)
    title_ar: str | None = Field(None, max_length=255)
    title_en: str | None = Field(None, max_length=255)
    title_fr: str | None = Field(None, max_length=255)


class ListingTransition(BaseModel):
    status: Literal["draft", "published", "under_offer", "sold", "withdrawn"]


# ── Offres ───────────────────────────────────────────────────────────────────


class OfferOut(BaseModel):
    id: uuid.UUID
    reference: str
    listing_id: uuid.UUID
    buyer_client_id: uuid.UUID
    amount: Decimal
    status: str
    decided_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OfferCreate(BaseModel):
    listing_id: uuid.UUID
    buyer_client_id: uuid.UUID
    amount: Decimal = Field(..., ge=0)


class OfferTransition(BaseModel):
    status: Literal["accepted", "rejected", "withdrawn"]


# ── Transactions ───────────────────────────────────────────────────────────


class TransactionOut(BaseModel):
    id: uuid.UUID
    reference: str
    listing_id: uuid.UUID
    offer_id: uuid.UUID | None
    final_price: Decimal
    commission_amount: Decimal
    status: str
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    # On crée une transaction à partir d'une offre acceptée. Le prix final retombe
    # sur le montant de l'offre si non fourni ; la commission est calculée serveur.
    offer_id: uuid.UUID
    final_price: Decimal | None = Field(default=None, ge=0)


class TransactionTransition(BaseModel):
    status: Literal["completed", "cancelled"]


# ── Enveloppes standard {success, data, meta} ──────────────────────────────


class MandateListOut(BaseModel):
    success: bool = True
    data: list[MandateOut]
    meta: dict[str, Any]


class MandateItemOut(BaseModel):
    success: bool = True
    data: MandateOut


class ListingListOut(BaseModel):
    success: bool = True
    data: list[ListingOut]
    meta: dict[str, Any]


class ListingItemOut(BaseModel):
    success: bool = True
    data: ListingOut


class OfferListOut(BaseModel):
    success: bool = True
    data: list[OfferOut]
    meta: dict[str, Any]


class OfferItemOut(BaseModel):
    success: bool = True
    data: OfferOut


class TransactionListOut(BaseModel):
    success: bool = True
    data: list[TransactionOut]
    meta: dict[str, Any]


class TransactionItemOut(BaseModel):
    success: bool = True
    data: TransactionOut
