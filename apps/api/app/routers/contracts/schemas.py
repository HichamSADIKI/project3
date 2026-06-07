"""Schémas Pydantic v2 — Contracts."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class ContractCreate(BaseModel):
    type: Literal["sale", "rental"]
    client_id: uuid.UUID
    property_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    amount: Decimal = Field(..., gt=0)
    commission_rate: Decimal = Field(Decimal("2.0"), ge=0, le=100)
    start_date: date | None = None
    end_date: date | None = None
    notes_en: str | None = None
    notes_ar: str | None = None
    notes_fr: str | None = None


class ContractUpdate(BaseModel):
    amount: Decimal | None = Field(None, gt=0)
    commission_rate: Decimal | None = None
    status: str | None = Field(None, pattern="^(draft|signed|active|expired|cancelled)$")
    start_date: date | None = None
    end_date: date | None = None
    notes_en: str | None = None
    notes_ar: str | None = None
    notes_fr: str | None = None


class ContractOut(BaseModel):
    id: uuid.UUID
    reference: str
    type: str
    client_id: uuid.UUID
    property_id: uuid.UUID
    agent_id: uuid.UUID | None
    amount: Decimal
    commission_rate: Decimal
    commission_amount: Decimal | None
    status: str
    signed_at: datetime | None
    start_date: date | None
    end_date: date | None
    notes_en: str | None
    notes_ar: str | None
    notes_fr: str | None
    documents: list[str]
    renewed_from_contract_id: uuid.UUID | None
    signing_document_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContractListOut(BaseModel):
    success: bool = True
    data: list[ContractOut]
    meta: dict[str, Any]


class ContractDetailOut(BaseModel):
    success: bool = True
    data: ContractOut


class ExpiringContractEntry(BaseModel):
    id: uuid.UUID
    reference: str | None
    type: str
    status: str
    end_date: date | None
    days_until_end: int | None
    expiry_state: str | None
    is_renewable: bool
    suggested_renewal_start: date | None
    suggested_renewal_end: date | None


class ExpiringContractsOut(BaseModel):
    success: bool = True
    data: list[ExpiringContractEntry]
    meta: dict[str, Any]


# ─── Renouvellement & signature (M5) ────────────────────────────────────────


class ContractRenew(BaseModel):
    term_months: int | None = Field(None, ge=1, le=120)
    rent_escalation_pct: Decimal = Field(Decimal("0"), ge=0, le=100)


class SignatureLink(BaseModel):
    document_id: uuid.UUID
