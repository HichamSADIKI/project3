"""Schémas Pydantic v2 — module Paiements (Phase 8)."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

TYPE_PATTERN = "^(rent|charges|deposit|deposit_return|owner_payout|other)$"
METHOD_PATTERN = "^(bank_transfer|card|cash|cheque|online)$"


# ── Demandes de paiement ──────────────────────────────────────────────────


class RequestCreate(BaseModel):
    payment_type: str = Field(..., pattern=TYPE_PATTERN)
    amount_aed: Decimal = Field(..., gt=0, decimal_places=2)
    due_date: date
    tenant_client_id: uuid.UUID | None = None
    owner_client_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    rental_id: uuid.UUID | None = None
    description: str | None = Field(None, max_length=2000)


class PayIn(BaseModel):
    method: str = Field("online", pattern=METHOD_PATTERN)
    external_ref: str | None = Field(None, max_length=255)


class RequestOut(BaseModel):
    id: uuid.UUID
    reference: str
    tenant_client_id: uuid.UUID | None
    owner_client_id: uuid.UUID | None
    unit_id: uuid.UUID | None
    rental_id: uuid.UUID | None
    payment_type: str
    status: str
    amount_aed: Decimal
    due_date: date
    paid_at: datetime | None
    description: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RequestListOut(BaseModel):
    success: bool = True
    data: list[RequestOut]
    meta: dict[str, Any]


class TransactionOut(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    status: str
    method: str
    amount_aed: Decimal
    external_ref: str | None
    settled_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OwnerSummaryOut(BaseModel):
    """Résumé financier du propriétaire connecté."""

    total_received_aed: Decimal
    pending_aed: Decimal
    overdue_aed: Decimal
    requests_count: int
