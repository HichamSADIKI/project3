"""Schémas Pydantic v2 — Developers / Promoteurs."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class DeveloperCreate(BaseModel):
    name_en: str = Field(..., min_length=1, max_length=300)
    name_ar: str | None = Field(None, max_length=300)
    name_fr: str | None = Field(None, max_length=300)
    city: str | None = Field(None, max_length=150)
    country: str | None = Field(None, max_length=100)
    trade_license: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=40)
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=255)
    projects_count: int = Field(0, ge=0)
    units_count: int = Field(0, ge=0)
    notes: str | None = None


class DeveloperUpdate(BaseModel):
    name_en: str | None = Field(None, min_length=1, max_length=300)
    name_ar: str | None = Field(None, max_length=300)
    name_fr: str | None = Field(None, max_length=300)
    city: str | None = Field(None, max_length=150)
    country: str | None = Field(None, max_length=100)
    trade_license: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=40)
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=255)
    projects_count: int | None = Field(None, ge=0)
    units_count: int | None = Field(None, ge=0)
    is_active: bool | None = None
    notes: str | None = None


class DeveloperOut(BaseModel):
    id: uuid.UUID
    reference: str
    name_en: str
    name_ar: str | None
    name_fr: str | None
    city: str | None
    country: str | None
    trade_license: str | None
    phone: str | None
    email: str | None
    website: str | None
    projects_count: int
    units_count: int
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeveloperListOut(BaseModel):
    success: bool = True
    data: list[DeveloperOut]
    meta: dict[str, Any]


class DeveloperDetailOut(BaseModel):
    success: bool = True
    data: DeveloperOut
