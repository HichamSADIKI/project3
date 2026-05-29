import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

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


# ── Profil fournisseur ─────────────────────────────────────────────────────
class VendorProfileOut(BaseModel):
    """Profil prestataire lié au compte fournisseur (table vendors)."""

    party_id: uuid.UUID
    vendor_type: str
    categories: list[str] = Field(default_factory=list)
    verification_status: str
    specialities: list[str] = Field(default_factory=list)
    service_areas: list[str] = Field(default_factory=list)
    trade_licence_number: str | None = None
    trade_licence_expiry: date | None = None
    trade_licence_authority: str | None = None
    insurance_policy_number: str | None = None
    insurance_expiry: date | None = None
    rating_avg: Decimal = Decimal("0")
    rating_count: int = 0
    emergency_24_7: bool = False
    is_active: bool = True
    commercial_license_url: str | None = None
    commercial_license_extracted: dict[str, Any] = Field(default_factory=dict)
    rejection_reason: str | None = None
    verified_at: datetime | None = None


class FournisseurProfileOut(BaseModel):
    """Vue « Profil fournisseur » de l'espace portail (compte + profil prestataire)."""

    email: str
    full_name: str
    role: str
    status: str
    profile: VendorProfileOut | None = None


# ── Documents KYC ───────────────────────────────────────────────────────────
class VendorDocumentOut(BaseModel):
    id: uuid.UUID
    doc_type: str
    original_filename: str | None = None
    expiry_date: date | None = None
    status: str
    days_until_expiry: int | None = None
    url: str | None = None
    extracted: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


# ── Missions / interventions ────────────────────────────────────────────────
class MissionOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: str
    scheduled_date: date | None
    location_text: str | None
    amount_aed: Decimal | None
    completed_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MissionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(accepted|in_progress|done|cancelled)$")


# ── Messagerie agence ───────────────────────────────────────────────────────
class MessageOut(BaseModel):
    id: uuid.UUID
    sender_user_id: uuid.UUID
    recipient_user_id: uuid.UUID
    subject: str | None
    body: str
    read_at: datetime | None
    created_at: datetime
    outgoing: bool = False

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(BaseModel):
    subject: str | None = Field(default=None, max_length=255)
    body: str = Field(..., min_length=1, max_length=5000)


# ── Dashboard ────────────────────────────────────────────────────────────
class PartnerDashboardOut(BaseModel):
    active_mandates: int
    pending_submissions: int
    active_leads: int
    converted_leads: int
    commissions_pending_aed: Decimal
    commissions_paid_aed: Decimal
    active_services: int
