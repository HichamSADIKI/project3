"""Schémas Pydantic v2 — Vendors (prestataires externes)."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

VendorType = Literal[
    "maintenance",
    "cleaning",
    "security",
    "landscaping",
    "pest_control",
    "elevator",
    "moving",
    "hvac",
    "electrical",
    "plumbing",
    "other",
]
PaymentTerms = Literal["net_15", "net_30", "net_60", "on_completion", "advance_50"]
ServiceArea = Literal["DXB", "AUH", "SHJ", "AJM", "RAK", "FUJ", "UAQ"]


class VendorCreate(BaseModel):
    party_id: uuid.UUID
    vendor_type: VendorType
    categories: list[VendorType] = Field(default_factory=list)
    specialities: list[str] = Field(default_factory=list)
    service_areas: list[ServiceArea] = Field(default_factory=list)

    trade_licence_number: str | None = Field(None, max_length=50)
    trade_licence_expiry: date | None = None
    trade_licence_authority: str | None = Field(None, max_length=100)

    insurance_policy_number: str | None = Field(None, max_length=100)
    insurance_expiry: date | None = None

    preferred_payment_terms: PaymentTerms | None = None
    emergency_24_7: bool = False


class VendorUpdate(BaseModel):
    vendor_type: VendorType | None = None
    # Catégories activées par l'admin — au moins une si fournie.
    categories: list[VendorType] | None = Field(default=None, min_length=1)
    specialities: list[str] | None = None
    service_areas: list[ServiceArea] | None = None
    trade_licence_number: str | None = None
    trade_licence_expiry: date | None = None
    trade_licence_authority: str | None = None
    insurance_policy_number: str | None = None
    insurance_expiry: date | None = None
    preferred_payment_terms: PaymentTerms | None = None
    emergency_24_7: bool | None = None
    is_active: bool | None = None


class VendorRatingInput(BaseModel):
    """Notation après intervention — score 0-5."""

    score: Decimal = Field(..., ge=0, le=5)


class VendorOut(BaseModel):
    party_id: uuid.UUID
    vendor_type: str
    categories: list[str] = Field(default_factory=list)
    specialities: list[str]
    service_areas: list[str]
    trade_licence_number: str | None
    trade_licence_expiry: date | None
    trade_licence_authority: str | None
    insurance_policy_number: str | None
    insurance_expiry: date | None
    rating_avg: Decimal
    rating_count: int
    response_time_hours_avg: Decimal | None
    on_time_rate: Decimal | None
    jobs_completed: int
    jobs_cancelled: int
    preferred_payment_terms: str | None
    emergency_24_7: bool
    is_active: bool
    # Onboarding fournisseur unifié (compte + licence + validation)
    account_user_id: uuid.UUID | None = None
    verification_status: str = "verified"
    commercial_license_path: str | None = None
    commercial_license_extracted: dict[str, Any] = Field(default_factory=dict)
    verified_at: datetime | None = None
    rejection_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VendorListOut(BaseModel):
    success: bool = True
    data: list[VendorOut]
    meta: dict[str, Any]


class VendorDetailOut(BaseModel):
    success: bool = True
    data: VendorOut
