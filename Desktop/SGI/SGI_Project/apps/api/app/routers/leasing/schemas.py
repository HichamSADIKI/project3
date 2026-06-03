"""Schémas Pydantic v2 — Leasing / Location."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Annonces de location ──────────────────────────────────────────────────────


class ListingOut(BaseModel):
    id: uuid.UUID
    reference: str
    unit_id: uuid.UUID | None
    title_ar: str | None
    title_en: str | None
    title_fr: str | None
    monthly_rent: Decimal
    annual_rent: Decimal | None
    status: str
    available_from: date | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ListingCreate(BaseModel):
    unit_id: uuid.UUID | None = None
    title_ar: str | None = Field(None, max_length=255)
    title_en: str | None = Field(None, max_length=255)
    title_fr: str | None = Field(None, max_length=255)
    monthly_rent: Decimal = Field(..., ge=0)
    annual_rent: Decimal | None = Field(None, ge=0)
    available_from: date | None = None


class ListingTransitionBody(BaseModel):
    status: Literal["draft", "published", "reserved", "leased", "withdrawn"]


# ── Candidatures locataires ───────────────────────────────────────────────────


class ApplicationOut(BaseModel):
    id: uuid.UUID
    reference: str
    listing_id: uuid.UUID
    applicant_client_id: uuid.UUID
    offered_rent: Decimal | None
    status: str
    screening_notes: str | None
    decided_at: datetime | None
    converted_rental_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApplicationCreate(BaseModel):
    listing_id: uuid.UUID
    applicant_client_id: uuid.UUID
    offered_rent: Decimal | None = Field(None, ge=0)
    screening_notes: str | None = Field(None, max_length=10000)


class ApplicationTransitionBody(BaseModel):
    status: Literal["submitted", "screening", "approved", "rejected", "converted"]
    # Renseigné uniquement lors d'un passage vers `converted` (bail effectif).
    converted_rental_id: uuid.UUID | None = None


# ── Enveloppes standard {success, data, meta} ──────────────────────────────


class ListingListOut(BaseModel):
    success: bool = True
    data: list[ListingOut]
    meta: dict[str, Any]


class ListingItemOut(BaseModel):
    success: bool = True
    data: ListingOut


class ApplicationListOut(BaseModel):
    success: bool = True
    data: list[ApplicationOut]
    meta: dict[str, Any]


class ApplicationItemOut(BaseModel):
    success: bool = True
    data: ApplicationOut
