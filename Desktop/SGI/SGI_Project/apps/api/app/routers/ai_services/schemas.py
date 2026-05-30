"""Schémas Pydantic v2 — module IA (Phase 9)."""

import uuid

from pydantic import BaseModel


class ContractSummaryOut(BaseModel):
    contract_id: uuid.UUID
    reference: str
    summary: str
    engine: str


class RiskOut(BaseModel):
    unit_id: uuid.UUID
    ticket_count: int
    recurring_category: str | None
    sla_breaches: int
    risk_score: int  # 0-100
    risk_level: str  # low | medium | high | critical


class PredictionOut(BaseModel):
    unit_id: uuid.UUID
    risk_score: int
    risk_level: str
    top_category: str | None
    suggested_cron: str | None
    rationale: str


class PredictionListOut(BaseModel):
    success: bool = True
    data: list[PredictionOut]
    meta: dict
