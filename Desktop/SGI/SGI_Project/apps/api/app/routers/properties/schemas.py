"""Schémas Pydantic v2 pour le module Properties."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class PropertyCreate(BaseModel):
    type: str = Field(
        ...,
        pattern="^(villa|apartment|office|penthouse|townhouse|plot|commercial)$",
    )
    title_en: str | None = Field(None, max_length=300)
    title_ar: str | None = Field(None, max_length=300)
    title_fr: str | None = Field(None, max_length=300)
    description_en: str | None = None
    description_ar: str | None = None
    description_fr: str | None = None
    price: Decimal = Field(..., gt=0, decimal_places=2)
    area_sqm: Decimal | None = Field(None, gt=0)
    bedrooms: int | None = Field(None, ge=0)
    bathrooms: int | None = Field(None, ge=0)
    status: str = Field(
        "available",
        pattern="^(available|under_offer|reserved|sold|rented)$",
    )
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    address_en: str | None = Field(None, max_length=300)
    address_ar: str | None = Field(None, max_length=300)
    district: str | None = Field(None, max_length=150)
    city: str = Field("Dubai", max_length=100)
    developer: str | None = Field(None, max_length=200)
    year_built: int | None = Field(None, ge=1900, le=2030)
    floor: int | None = None
    total_floors: int | None = None
    furnished: bool = False
    parking_spaces: int = Field(0, ge=0)
    amenities: list[str] = []
    is_featured: bool = False
    agent_id: uuid.UUID | None = None


class PropertyUpdate(BaseModel):
    type: str | None = None
    title_en: str | None = None
    title_ar: str | None = None
    title_fr: str | None = None
    description_en: str | None = None
    description_ar: str | None = None
    description_fr: str | None = None
    price: Decimal | None = Field(None, gt=0)
    area_sqm: Decimal | None = Field(None, gt=0)
    bedrooms: int | None = Field(None, ge=0)
    bathrooms: int | None = Field(None, ge=0)
    status: str | None = Field(
        None,
        pattern="^(available|under_offer|reserved|sold|rented)$",
    )
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    address_en: str | None = Field(None, max_length=300)
    address_ar: str | None = Field(None, max_length=300)
    district: str | None = Field(None, max_length=150)
    city: str | None = Field(None, max_length=100)
    developer: str | None = Field(None, max_length=200)
    year_built: int | None = Field(None, ge=1900, le=2030)
    floor: int | None = None
    total_floors: int | None = None
    furnished: bool | None = None
    parking_spaces: int | None = Field(None, ge=0)
    amenities: list[str] | None = None
    is_featured: bool | None = None
    agent_id: uuid.UUID | None = None


class PropertyOut(BaseModel):
    id: uuid.UUID
    reference: str
    type: str
    title_en: str | None
    title_ar: str | None
    title_fr: str | None
    description_en: str | None = None
    description_ar: str | None = None
    description_fr: str | None = None
    price: Decimal
    area_sqm: Decimal | None
    bedrooms: int | None
    bathrooms: int | None
    status: str
    latitude: float | None = None
    longitude: float | None = None
    address_en: str | None
    address_ar: str | None
    district: str | None
    city: str
    developer: str | None
    year_built: int | None
    floor: int | None = None
    total_floors: int | None = None
    furnished: bool
    parking_spaces: int
    amenities: list[str]
    images: list[str]
    is_featured: bool
    views_count: int
    agent_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PropertyListOut(BaseModel):
    success: bool = True
    data: list[PropertyOut]
    meta: dict[str, Any]


class PropertyDetailOut(BaseModel):
    success: bool = True
    data: PropertyOut


class RadiusSearchQuery(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_m: float = Field(5000, gt=0, le=50000)
    type: str | None = None
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    bedrooms: int | None = None
    limit: int = Field(20, le=100)
