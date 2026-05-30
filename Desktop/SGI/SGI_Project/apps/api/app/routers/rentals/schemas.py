"""Schémas Pydantic v2 — Rentals."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class RentalCreate(BaseModel):
    contract_id: uuid.UUID
    client_id: uuid.UUID
    property_id: uuid.UUID
    monthly_rent: Decimal = Field(..., gt=0)
    deposit: Decimal = Field(Decimal("0"), ge=0)
    payment_frequency: Literal["monthly", "quarterly", "semi_annual", "annual"] = "monthly"
    start_date: date
    end_date: date


class RentalUpdate(BaseModel):
    status: str | None = Field(None, pattern="^(active|expiring|expired|terminated)$")
    monthly_rent: Decimal | None = Field(None, gt=0)
    end_date: date | None = None
    renewal_alert_sent: bool | None = None


class RentalOut(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    client_id: uuid.UUID
    property_id: uuid.UUID
    monthly_rent: Decimal
    annual_rent: Decimal
    deposit: Decimal
    payment_frequency: str
    status: str
    start_date: date
    end_date: date
    renewal_alert_sent: bool
    payment_schedule: list[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RentalListOut(BaseModel):
    success: bool = True
    data: list[RentalOut]
    meta: dict[str, Any]


class RentalDetailOut(BaseModel):
    success: bool = True
    data: RentalOut
