"""Schémas Pydantic v2 — Rapprochement bancaire."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ── Comptes bancaires ────────────────────────────────────────────────────────


class BankAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    account_number: str | None = Field(None, max_length=50)
    currency: str = Field("AED", min_length=3, max_length=3)


class BankAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    account_number: str | None
    currency: str
    is_active: bool
    created_at: datetime


class BankAccountListOut(BaseModel):
    success: bool = True
    data: list[BankAccountOut]
    meta: dict[str, Any]


class BankAccountDetailOut(BaseModel):
    success: bool = True
    data: BankAccountOut


# ── Lignes de relevé ─────────────────────────────────────────────────────────


class StatementLineCreate(BaseModel):
    bank_account_id: uuid.UUID
    value_date: date
    label: str = Field(..., min_length=1, max_length=500)
    # Montant SIGNÉ : positif = entrée (crédit), négatif = sortie (débit). ≠ 0.
    amount: Decimal = Field(..., decimal_places=2)


class StatementLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bank_account_id: uuid.UUID
    value_date: date
    label: str
    amount: Decimal
    status: str
    matched_transaction_id: uuid.UUID | None
    matched_at: datetime | None
    created_at: datetime


class StatementLineListOut(BaseModel):
    success: bool = True
    data: list[StatementLineOut]
    meta: dict[str, Any]


class StatementLineDetailOut(BaseModel):
    success: bool = True
    data: StatementLineOut


# ── Rapprochement ────────────────────────────────────────────────────────────


class MatchIn(BaseModel):
    transaction_id: uuid.UUID


class MatchSuggestion(BaseModel):
    transaction_id: uuid.UUID
    reference: str
    amount: Decimal
    direction: str
    status: str
    due_date: date | None
    paid_at: datetime | None


class SuggestionsOut(BaseModel):
    success: bool = True
    data: list[MatchSuggestion]


class ReconSummary(BaseModel):
    reconciled_count: int
    unreconciled_count: int
    reconciled_amount: Decimal
    unreconciled_amount: Decimal


class ReconSummaryOut(BaseModel):
    success: bool = True
    data: ReconSummary
