"""Schémas Pydantic v2 — Relevés propriétaires (M6)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class OwnerStatementOut(BaseModel):
    id: uuid.UUID
    owner_party_id: uuid.UUID
    period_year: int
    period_month: int
    gross_revenue_aed: Decimal
    expenses_aed: Decimal
    commission_aed: Decimal
    net_payout_aed: Decimal
    currency: str
    status: str
    line_items: list[dict[str, Any]]
    document_id: uuid.UUID | None
    generated_at: datetime | None
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OwnerStatementResponse(BaseModel):
    success: bool = True
    data: OwnerStatementOut


class OwnerStatementListOut(BaseModel):
    success: bool = True
    data: list[OwnerStatementOut]
    meta: dict[str, Any]
