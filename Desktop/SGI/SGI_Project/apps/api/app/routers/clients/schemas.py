"""Schémas Pydantic v2 — Clients (individus + sociétés)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


class ClientCreate(BaseModel):
    type: Literal["individual", "company"]
    # Individual fields
    first_name: str | None = Field(None, max_length=150)
    last_name: str | None = Field(None, max_length=150)
    # Company fields
    company_name: str | None = Field(None, max_length=255)
    # Common
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    phone2: str | None = Field(None, max_length=50)
    nationality: str | None = Field(None, max_length=100)
    country_of_residence: str | None = Field(None, max_length=100)
    source: str | None = Field(None, pattern="^(crm|portal|referral|walk_in|website|other)$")
    budget_min: Decimal | None = Field(None, ge=0)
    budget_max: Decimal | None = Field(None, ge=0)
    preferred_property_type: str | None = None
    preferred_location: str | None = None
    notes: str | None = None
    assigned_agent_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def check_required_fields(self) -> "ClientCreate":
        if self.type == "individual" and not self.first_name and not self.last_name:
            raise ValueError("first_name or last_name required for individual")
        if self.type == "company" and not self.company_name:
            raise ValueError("company_name required for company type")
        return self


class ClientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    company_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    phone2: str | None = None
    nationality: str | None = None
    budget_min: Decimal | None = None
    budget_max: Decimal | None = None
    preferred_property_type: str | None = None
    preferred_location: str | None = None
    notes: str | None = None
    assigned_agent_id: uuid.UUID | None = None


class ClientOut(BaseModel):
    id: uuid.UUID
    type: str
    first_name: str | None
    last_name: str | None
    company_name: str | None
    email: str | None
    phone: str | None
    phone2: str | None
    nationality: str | None
    country_of_residence: str | None
    source: str | None
    budget_min: Decimal | None
    budget_max: Decimal | None
    preferred_property_type: str | None
    preferred_location: str | None
    notes: str | None
    assigned_agent_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientListOut(BaseModel):
    success: bool = True
    data: list[ClientOut]
    meta: dict[str, Any]


class ClientDetailOut(BaseModel):
    success: bool = True
    data: ClientOut


class ClientsSegmentation(BaseModel):
    by_type: dict[str, int]
    by_source: dict[str, int]
    golden_visa_budget_count: int
    total: int


class ClientsSegmentationOut(BaseModel):
    success: bool = True
    data: ClientsSegmentation
    meta: dict[str, Any]
