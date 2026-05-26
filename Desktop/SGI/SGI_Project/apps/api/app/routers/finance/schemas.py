"""Schémas Pydantic v2 — Finance."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    type: Literal["invoice", "payment", "expense", "commission", "refund"]
    direction: Literal["debit", "credit"] = "debit"
    amount: Decimal = Field(..., gt=0)
    currency: str = Field("AED", max_length=3)
    description_en: str | None = Field(None, max_length=500)
    description_ar: str | None = Field(None, max_length=500)
    description_fr: str | None = Field(None, max_length=500)
    related_contract_id: uuid.UUID | None = None
    related_client_id: uuid.UUID | None = None
    related_property_id: uuid.UUID | None = None
    due_date: date | None = None
    payment_method: str | None = Field(
        None, pattern="^(bank_transfer|cheque|cash|card)$"
    )
    bank_reference: str | None = None


class TransactionUpdate(BaseModel):
    status: str | None = Field(
        None, pattern="^(pending|paid|cancelled|overdue)$"
    )
    paid_at: datetime | None = None
    payment_method: str | None = None
    bank_reference: str | None = None


class TransactionOut(BaseModel):
    id: uuid.UUID
    reference: str
    type: str
    direction: str
    amount: Decimal
    currency: str
    status: str
    description_en: str | None
    description_ar: str | None
    description_fr: str | None
    related_contract_id: uuid.UUID | None
    related_client_id: uuid.UUID | None
    related_property_id: uuid.UUID | None
    due_date: date | None
    paid_at: datetime | None
    payment_method: str | None
    bank_reference: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionListOut(BaseModel):
    success: bool = True
    data: list[TransactionOut]
    meta: dict[str, Any]


class TransactionDetailOut(BaseModel):
    success: bool = True
    data: TransactionOut


class FinanceSummary(BaseModel):
    total_revenue: Decimal
    total_expenses: Decimal
    net: Decimal
    pending_invoices: int
    pending_amount: Decimal
    paid_this_month: Decimal
