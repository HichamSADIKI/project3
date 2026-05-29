"""Schémas Pydantic v2 — module Inspections (Phase 7)."""
import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

TYPE_PATTERN   = "^(check_in|check_out|periodic|pre_sale)$"
STATUS_PATTERN = "^(draft|scheduled|in_progress|completed|signed|cancelled)$"
COND_PATTERN   = "^(good|fair|poor|missing|na)$"


# ── Inspection ────────────────────────────────────────────────────────────

class InspectionCreate(BaseModel):
    unit_id: uuid.UUID
    inspection_type: str = Field(..., pattern=TYPE_PATTERN)
    rental_id: uuid.UUID | None = None
    contract_id: uuid.UUID | None = None
    scheduled_date: date | None = None
    inspector_user_id: uuid.UUID | None = None
    tenant_user_id: uuid.UUID | None = None
    owner_user_id: uuid.UUID | None = None
    notes: str | None = Field(None, max_length=5000)


class InspectionUpdate(BaseModel):
    scheduled_date: date | None = None
    inspector_user_id: uuid.UUID | None = None
    notes: str | None = Field(None, max_length=5000)


class SignIn(BaseModel):
    signed_by: str = Field(..., min_length=2, max_length=255)


class InspectionOut(BaseModel):
    id: uuid.UUID
    reference: str
    unit_id: uuid.UUID
    rental_id: uuid.UUID | None
    contract_id: uuid.UUID | None
    inspection_type: str
    status: str
    scheduled_date: date | None
    inspector_user_id: uuid.UUID | None
    tenant_user_id: uuid.UUID | None
    owner_user_id: uuid.UUID | None
    notes: str | None
    overall_score: float | None
    completed_at: datetime | None
    signed_by: str | None
    signed_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InspectionListOut(BaseModel):
    success: bool = True
    data: list[InspectionOut]
    meta: dict[str, Any]


class InspectionDetailOut(BaseModel):
    success: bool = True
    data: InspectionOut


# ── Sections ──────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    section_order: int = 0
    notes: str | None = None


class SectionOut(BaseModel):
    id: uuid.UUID
    inspection_id: uuid.UUID
    name: str
    section_order: int
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


# ── Items ─────────────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    item_order: int = 0
    condition: str | None = Field(None, pattern=COND_PATTERN)
    score: int | None = Field(None, ge=0, le=5)
    comment: str | None = None


class ItemUpdate(BaseModel):
    condition: str | None = Field(None, pattern=COND_PATTERN)
    score: int | None = Field(None, ge=0, le=5)
    comment: str | None = None


class ItemOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    name: str
    item_order: int
    condition: str | None
    score: int | None
    comment: str | None

    model_config = ConfigDict(from_attributes=True)


# ── Photos ────────────────────────────────────────────────────────────────

class PhotoOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    file_key: str
    caption: str | None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)
