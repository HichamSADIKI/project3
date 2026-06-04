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
    payment_method: str | None = Field(None, pattern="^(bank_transfer|cheque|cash|card)$")
    bank_reference: str | None = None


class TransactionUpdate(BaseModel):
    status: str | None = Field(None, pattern="^(pending|paid|cancelled|overdue)$")
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


# ── Rapports ──────────────────────────────────────────────────────────────


class PnlReport(BaseModel):
    """Compte de résultat (P&L) : revenus/dépenses encaissés par type."""

    period: Literal["month", "quarter", "ytd"]
    revenue_by_type: dict[str, Decimal] = Field(default_factory=dict)
    expense_by_type: dict[str, Decimal] = Field(default_factory=dict)
    total_revenue: Decimal
    total_expenses: Decimal
    net: Decimal


class AgedBuckets(BaseModel):
    current: Decimal
    d1_30: Decimal
    d31_60: Decimal
    d61_90: Decimal
    d90plus: Decimal


class AgedReceivables(BaseModel):
    """Balance âgée des factures impayées par tranche de retard."""

    buckets: AgedBuckets
    total: Decimal
    count: int


class VatReport(BaseModel):
    """Rapport TVA (UAE 5 %) dérivé des transactions encaissées de la période.

    Hypothèse : montants HT, standard-rated à 5 %. `output_vat` = TVA collectée
    sur les revenus ; `input_vat` = TVA déductible sur les dépenses ; `net_vat`
    = à reverser (positif) ou crédit (négatif)."""

    period: Literal["month", "quarter", "ytd"]
    rate: Decimal
    taxable_revenue: Decimal
    taxable_expenses: Decimal
    output_vat: Decimal
    input_vat: Decimal
    net_vat: Decimal
