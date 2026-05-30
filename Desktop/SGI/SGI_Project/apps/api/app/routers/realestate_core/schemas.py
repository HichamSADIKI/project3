"""Schémas Pydantic v2 — Immobilier Core (branches + company settings)."""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

Emirate = Literal["DXB", "AUH", "SHJ", "AJM", "RAK", "FUJ", "UAQ"]


class GeoPoint(BaseModel):
    """{lat, lng} en WGS84."""

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


# ─── Branches ──────────────────────────────────────────────────────────────


class BranchCreate(BaseModel):
    # `code` optionnel : généré (BR-NNN) côté service s'il est absent.
    code: str | None = Field(None, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    name_ar: str | None = None
    name_en: str | None = None
    name_fr: str | None = None
    emirate: Emirate = "DXB"
    address: str | None = None
    location: GeoPoint | None = None
    phone: str | None = Field(None, max_length=40)
    email: EmailStr | None = None
    manager_user_id: uuid.UUID | None = None
    is_active: bool = True


class BranchUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    name_ar: str | None = None
    name_en: str | None = None
    name_fr: str | None = None
    emirate: Emirate | None = None
    address: str | None = None
    location: GeoPoint | None = None
    phone: str | None = Field(None, max_length=40)
    email: EmailStr | None = None
    manager_user_id: uuid.UUID | None = None
    is_active: bool | None = None


class BranchOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    name_ar: str | None
    name_en: str | None
    name_fr: str | None
    emirate: str
    address: str | None
    phone: str | None
    email: str | None
    manager_user_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BranchListOut(BaseModel):
    success: bool = True
    data: list[BranchOut]
    meta: dict[str, Any]


class BranchDetailOut(BaseModel):
    success: bool = True
    data: BranchOut


# ─── Company settings ──────────────────────────────────────────────────────


class CompanySettingsUpdate(BaseModel):
    currency: str | None = Field(None, min_length=3, max_length=3)
    vat_enabled: bool | None = None
    vat_rate: Decimal | None = Field(None, ge=0, le=100)
    default_emirate: Emirate | None = None
    timezone: str | None = Field(None, max_length=50)
    ejari_enabled: bool | None = None
    dld_enabled: bool | None = None
    fiscal_year_start_month: int | None = Field(None, ge=1, le=12)
    invoice_prefix: str | None = Field(None, max_length=10)
    contract_prefix: str | None = Field(None, max_length=10)
    default_payment_terms_days: int | None = Field(None, ge=0, le=365)
    extra: dict[str, Any] | None = None


class CompanySettingsOut(BaseModel):
    id: uuid.UUID
    currency: str
    vat_enabled: bool
    vat_rate: Decimal
    default_emirate: str
    timezone: str
    ejari_enabled: bool
    dld_enabled: bool
    fiscal_year_start_month: int
    invoice_prefix: str
    contract_prefix: str
    default_payment_terms_days: int
    extra: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanySettingsResponse(BaseModel):
    success: bool = True
    data: CompanySettingsOut
