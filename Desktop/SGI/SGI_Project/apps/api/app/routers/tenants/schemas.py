"""Schémas Pydantic v2 — Tenants (profil locataire / candidat)."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


LifecycleStatus = Literal["candidate", "active", "former", "blacklisted"]
VisaType = Literal["employment", "family", "golden", "visit", "other"]


class TenantCreate(BaseModel):
    party_id: uuid.UUID
    lifecycle_status: LifecycleStatus = "candidate"

    emirates_id: str | None = Field(None, max_length=50)
    emirates_id_expiry: date | None = None
    passport_number: str | None = Field(None, max_length=50)
    passport_expiry: date | None = None

    visa_number: str | None = Field(None, max_length=50)
    visa_expiry: date | None = None
    visa_type: VisaType | None = None

    monthly_income_aed: Decimal | None = Field(None, ge=0)
    employer_name: str | None = Field(None, max_length=255)
    employer_phone: str | None = Field(None, max_length=50)

    emergency_contact_name: str | None = Field(None, max_length=200)
    emergency_contact_phone: str | None = Field(None, max_length=50)
    emergency_contact_relation: str | None = Field(None, max_length=50)

    loyalty_score: int = Field(50, ge=0, le=100)


class TenantUpdate(BaseModel):
    emirates_id: str | None = None
    emirates_id_expiry: date | None = None
    passport_number: str | None = None
    passport_expiry: date | None = None
    visa_number: str | None = None
    visa_expiry: date | None = None
    visa_type: VisaType | None = None
    monthly_income_aed: Decimal | None = Field(None, ge=0)
    employer_name: str | None = None
    employer_phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None


class TenantStatusChange(BaseModel):
    """Transition explicite du cycle de vie (validation côté service)."""

    target_status: LifecycleStatus
    reason: str | None = Field(None, max_length=500)


class TenantOut(BaseModel):
    party_id: uuid.UUID
    lifecycle_status: str
    emirates_id: str | None
    emirates_id_expiry: date | None
    passport_number: str | None
    passport_expiry: date | None
    visa_number: str | None
    visa_expiry: date | None
    visa_type: str | None
    monthly_income_aed: Decimal | None
    employer_name: str | None
    employer_phone: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    emergency_contact_relation: str | None
    loyalty_score: int
    candidacy_submitted_at: datetime | None
    candidacy_approved_at: datetime | None
    activated_at: datetime | None
    blacklisted_at: datetime | None
    blacklist_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantListOut(BaseModel):
    success: bool = True
    data: list[TenantOut]
    meta: dict[str, Any]


class TenantDetailOut(BaseModel):
    success: bool = True
    data: TenantOut
