"""Schémas Pydantic v2 — Buildings."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


BuildingType = Literal[
    "residential_tower", "villa_compound", "mixed_use", "commercial", "warehouse"
]
BuildingStatus = Literal[
    "operational", "under_renovation", "off_market", "demolished"
]
Tenure = Literal["freehold", "leasehold"]
Emirate = Literal["DXB", "AUH", "SHJ", "AJM", "RAK", "FUJ", "UAQ"]


class GeoPoint(BaseModel):
    """{lat, lng} en WGS84."""

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class BuildingCreate(BaseModel):
    reference: str = Field(..., max_length=50)
    owner_party_id: uuid.UUID | None = None
    name_ar: str | None = None
    name_en: str | None = None
    name_fr: str | None = None
    building_type: BuildingType

    location: GeoPoint | None = None
    address_en: str | None = None
    address_ar: str | None = None
    district: str | None = None
    emirate: Emirate = "DXB"

    total_floors: int | None = Field(None, ge=-5, le=200)
    total_units: int | None = Field(None, ge=0)
    year_built: int | None = Field(None, ge=1900, le=2100)
    developer: str | None = None

    dld_property_number: str | None = None
    dld_tenure: Tenure | None = None

    insurance_policy_number: str | None = None
    insurance_expiry: date | None = None

    amenities: list[str] = Field(default_factory=list)

    estimated_value_aed: Decimal | None = Field(None, ge=0)
    notes: str | None = None


class BuildingUpdate(BaseModel):
    owner_party_id: uuid.UUID | None = None
    name_ar: str | None = None
    name_en: str | None = None
    name_fr: str | None = None
    building_type: BuildingType | None = None
    location: GeoPoint | None = None
    address_en: str | None = None
    address_ar: str | None = None
    district: str | None = None
    emirate: Emirate | None = None
    total_floors: int | None = None
    total_units: int | None = None
    year_built: int | None = None
    developer: str | None = None
    status: BuildingStatus | None = None
    dld_property_number: str | None = None
    dld_tenure: Tenure | None = None
    insurance_policy_number: str | None = None
    insurance_expiry: date | None = None
    amenities: list[str] | None = None
    estimated_value_aed: Decimal | None = None
    notes: str | None = None
    has_active_security_contract: bool | None = None
    has_active_cleaning_contract: bool | None = None


class BuildingOut(BaseModel):
    id: uuid.UUID
    reference: str
    owner_party_id: uuid.UUID | None
    name_ar: str | None
    name_en: str | None
    name_fr: str | None
    building_type: str
    address_en: str | None
    address_ar: str | None
    district: str | None
    emirate: str
    total_floors: int | None
    total_units: int | None
    year_built: int | None
    developer: str | None
    status: str
    dld_property_number: str | None
    dld_tenure: str | None
    insurance_policy_number: str | None
    insurance_expiry: date | None
    amenities: list[str]
    estimated_value_aed: Decimal | None
    has_active_security_contract: bool
    has_active_cleaning_contract: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BuildingListOut(BaseModel):
    success: bool = True
    data: list[BuildingOut]
    meta: dict[str, Any]


class BuildingDetailOut(BaseModel):
    success: bool = True
    data: BuildingOut


# ─── Floor ─────────────────────────────────────────────────────────────────


class FloorCreate(BaseModel):
    building_id: uuid.UUID
    floor_number: int = Field(..., ge=-5, le=200)
    label: str | None = None
    planned_units: int | None = Field(None, ge=0)


class FloorOut(BaseModel):
    id: uuid.UUID
    building_id: uuid.UUID
    floor_number: int
    label: str | None
    planned_units: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FloorListOut(BaseModel):
    success: bool = True
    data: list[FloorOut]
    meta: dict[str, Any]


# ─── Occupancy summary ─────────────────────────────────────────────────────


class OccupancySummary(BaseModel):
    """Synthèse d'occupation d'un building."""

    building_id: uuid.UUID
    total_units: int
    by_status: dict[str, int]
    occupancy_rate_pct: Decimal
    vacancy_rate_pct: Decimal


class OccupancySummaryOut(BaseModel):
    success: bool = True
    data: OccupancySummary
