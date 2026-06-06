"""Schémas Pydantic v2 — Technicians (techniciens internes salariés)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class TechnicianCreate(BaseModel):
    user_id: uuid.UUID = Field(..., description="ID du User salarié")
    skills: list[str] = Field(default_factory=list)
    assigned_zones: list[str] = Field(default_factory=list)
    mobile_active: bool = True
    on_call: bool = False
    emergency_contact_phone: str | None = Field(None, max_length=50)


class TechnicianUpdate(BaseModel):
    skills: list[str] | None = None
    assigned_zones: list[str] | None = None
    mobile_active: bool | None = None
    on_call: bool | None = None
    emergency_contact_phone: str | None = None


class TechnicianRatingInput(BaseModel):
    score: Decimal = Field(..., ge=0, le=5)


class TechnicianOut(BaseModel):
    user_id: uuid.UUID
    skills: list[str]
    assigned_zones: list[str]
    rating_avg: Decimal
    rating_count: int
    jobs_completed: int
    avg_resolution_hours: Decimal | None
    mobile_active: bool
    on_call: bool
    emergency_contact_phone: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TechnicianListOut(BaseModel):
    success: bool = True
    data: list[TechnicianOut]
    meta: dict[str, Any]


class TechnicianDetailOut(BaseModel):
    success: bool = True
    data: TechnicianOut


class TechniciansSummary(BaseModel):
    total: int
    mobile_active_count: int
    on_call_count: int
    by_skill: dict[str, int]
    jobs_completed_total: int


class TechniciansSummaryOut(BaseModel):
    success: bool = True
    data: TechniciansSummary
    meta: dict[str, Any]
