import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Submission de bien ───────────────────────────────────────────────────
class PropertySubmissionCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    type: str = Field(..., min_length=2, max_length=50)
    district: str | None = Field(default=None, max_length=150)
    city: str = Field(default="Dubai", max_length=100)
    asking_price: Decimal = Field(..., gt=0)
    area_sqm: Decimal | None = Field(default=None, gt=0)
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    contact_phone: str | None = Field(default=None, max_length=50)
    images: list[str] = Field(default_factory=list)


class PropertySubmissionOut(BaseModel):
    id: uuid.UUID
    title: str
    type: str
    district: str | None
    city: str
    asking_price: Decimal
    area_sqm: Decimal | None
    bedrooms: int | None
    bathrooms: int | None
    status: str
    review_notes: str | None
    converted_property_id: uuid.UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Partner lead ─────────────────────────────────────────────────────────
class PartnerLeadCreate(BaseModel):
    prospect_first_name: str = Field(..., min_length=1, max_length=150)
    prospect_last_name: str | None = Field(default=None, max_length=150)
    prospect_email: EmailStr | None = None
    prospect_phone: str = Field(..., min_length=4, max_length=50)
    prospect_nationality: str | None = Field(default=None, max_length=100)
    interest_type: str = Field(..., pattern="^(rent|buy|golden_visa|commercial)$")
    budget_aed: Decimal | None = Field(default=None, gt=0)
    notes: str | None = Field(default=None, max_length=2000)


class PartnerLeadOut(BaseModel):
    id: uuid.UUID
    prospect_first_name: str
    prospect_last_name: str | None
    prospect_email: str | None
    prospect_phone: str
    interest_type: str
    budget_aed: Decimal | None
    status: str
    commission_rate: Decimal | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Commission ───────────────────────────────────────────────────────────
class CommissionOut(BaseModel):
    id: uuid.UUID
    source_type: str
    source_id: uuid.UUID
    base_amount_aed: Decimal
    commission_rate: Decimal
    commission_amount_aed: Decimal
    status: str
    paid_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Service ──────────────────────────────────────────────────────────────
class PartnerServiceCreate(BaseModel):
    service_type: str = Field(
        ..., pattern="^(notary|bank|insurance|legal|translation|valuation|other)$"
    )
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    fee_aed: Decimal | None = Field(default=None, ge=0)


class PartnerServiceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    fee_aed: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class PartnerServiceOut(BaseModel):
    id: uuid.UUID
    service_type: str
    title: str
    description: str | None
    fee_aed: Decimal | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Dashboard ────────────────────────────────────────────────────────────
class PartnerDashboardOut(BaseModel):
    active_mandates: int
    pending_submissions: int
    active_leads: int
    converted_leads: int
    commissions_pending_aed: Decimal
    commissions_paid_aed: Decimal
    active_services: int
