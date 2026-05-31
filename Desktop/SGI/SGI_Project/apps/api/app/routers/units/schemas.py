"""Schémas Pydantic v2 — Units."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

UnitType = Literal[
    "studio",
    "apartment_1br",
    "apartment_2br",
    "apartment_3br",
    "apartment_4br_plus",
    "penthouse",
    "duplex",
    "villa",
    "townhouse",
    "office",
    "shop",
    "warehouse",
    "other",
]
UnitStatus = Literal["vacant", "occupied", "reserved", "maintenance", "renovation", "off_market"]


class UnitCreate(BaseModel):
    building_id: uuid.UUID
    floor_id: uuid.UUID | None = None
    unit_number: str = Field(..., max_length=50)
    unit_type: UnitType
    status: UnitStatus = "vacant"
    area_sqm: Decimal | None = Field(None, ge=0)
    bedrooms: int | None = Field(None, ge=0, le=20)
    bathrooms: int | None = Field(None, ge=0, le=20)
    parking_spaces: int = Field(0, ge=0, le=20)
    furnished: bool = False
    list_rent_aed: Decimal | None = Field(None, ge=0)
    list_sale_aed: Decimal | None = Field(None, ge=0)
    legacy_property_id: uuid.UUID | None = None
    ejari_number: str | None = None
    dewa_account_number: str | None = None
    addc_account_number: str | None = None
    inventory: list[dict[str, Any]] = Field(default_factory=list)
    notes: str | None = None


class UnitUpdate(BaseModel):
    floor_id: uuid.UUID | None = None
    unit_type: UnitType | None = None
    status: UnitStatus | None = None
    area_sqm: Decimal | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    parking_spaces: int | None = None
    furnished: bool | None = None
    list_rent_aed: Decimal | None = None
    list_sale_aed: Decimal | None = None
    ejari_number: str | None = None
    dewa_account_number: str | None = None
    addc_account_number: str | None = None
    inventory: list[dict[str, Any]] | None = None
    notes: str | None = None


class UnitStatusChange(BaseModel):
    """Changement de statut explicite avec validation côté service."""

    target_status: UnitStatus
    reason: str | None = None


class UnitOut(BaseModel):
    id: uuid.UUID
    building_id: uuid.UUID
    floor_id: uuid.UUID | None
    unit_number: str
    unit_type: str
    status: str
    area_sqm: Decimal | None
    bedrooms: int | None
    bathrooms: int | None
    parking_spaces: int
    furnished: bool
    list_rent_aed: Decimal | None
    list_sale_aed: Decimal | None
    legacy_property_id: uuid.UUID | None
    ejari_number: str | None
    dewa_account_number: str | None
    addc_account_number: str | None
    inventory: list[dict[str, Any]]
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UnitListOut(BaseModel):
    success: bool = True
    data: list[UnitOut]
    meta: dict[str, Any]


class UnitDetailOut(BaseModel):
    success: bool = True
    data: UnitOut
