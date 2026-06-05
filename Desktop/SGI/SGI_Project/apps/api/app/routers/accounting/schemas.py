"""Schémas Pydantic v2 — Comptabilité."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

AccountType = Literal["asset", "liability", "equity", "revenue", "expense"]


# ── Plan comptable ──────────────────────────────────────────────────────────


class AccountCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name_en: str = Field(..., min_length=1, max_length=255)
    name_ar: str | None = Field(None, max_length=255)
    name_fr: str | None = Field(None, max_length=255)
    type: AccountType
    parent_id: uuid.UUID | None = None
    is_active: bool = True


class AccountOut(BaseModel):
    id: uuid.UUID
    code: str
    name_en: str
    name_ar: str | None
    name_fr: str | None
    type: str
    parent_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountListOut(BaseModel):
    success: bool = True
    data: list[AccountOut]
    meta: dict[str, Any]


class AccountDetailOut(BaseModel):
    success: bool = True
    data: AccountOut


# ── Écritures de journal ────────────────────────────────────────────────────


class JournalLineIn(BaseModel):
    account_id: uuid.UUID
    debit: Decimal = Field(Decimal("0"), ge=0)
    credit: Decimal = Field(Decimal("0"), ge=0)
    description: str | None = Field(None, max_length=500)


class JournalLineOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    debit: Decimal
    credit: Decimal
    description: str | None

    model_config = {"from_attributes": True}


class JournalEntryCreate(BaseModel):
    entry_date: date
    description: str | None = Field(None, max_length=500)
    lines: list[JournalLineIn] = Field(..., min_length=2)


class JournalEntryOut(BaseModel):
    id: uuid.UUID
    reference: str
    entry_date: date
    description: str | None
    status: str
    posted_at: datetime | None
    lines: list[JournalLineOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JournalEntryListItem(BaseModel):
    id: uuid.UUID
    reference: str
    entry_date: date
    description: str | None
    status: str
    posted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JournalEntryListOut(BaseModel):
    success: bool = True
    data: list[JournalEntryListItem]
    meta: dict[str, Any]


class JournalEntryDetailOut(BaseModel):
    success: bool = True
    data: JournalEntryOut


# ── Balance générale (trial balance) ────────────────────────────────────────


class TrialBalanceRow(BaseModel):
    account_id: uuid.UUID
    code: str
    name_en: str
    type: str
    total_debit: Decimal
    total_credit: Decimal
    balance: Decimal


class TrialBalance(BaseModel):
    rows: list[TrialBalanceRow]
    total_debit: Decimal
    total_credit: Decimal


class TrialBalanceOut(BaseModel):
    success: bool = True
    data: TrialBalance
