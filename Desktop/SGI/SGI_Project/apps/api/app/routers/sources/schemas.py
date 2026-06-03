"""Schémas Pydantic v2 — Sources."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SourceTypeLiteral = Literal["contract", "social", "existing_customer", "other"]

# ── Sortie ─────────────────────────────────────────────────────────────────────


class SourceImportOut(BaseModel):
    id: uuid.UUID
    reference: str
    source_type: str
    source_channel: str | None
    external_id: str | None
    dedup_key: str
    status: str
    reject_reason: str | None
    created_lead_id: uuid.UUID | None
    created_client_id: uuid.UUID | None
    raw_payload: dict[str, Any]
    imported_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Entrée ─────────────────────────────────────────────────────────────────────


class CsvImportBody(BaseModel):
    """Lot d'enregistrements (CSV déjà parsé / payload JSON)."""

    source_type: SourceTypeLiteral
    source_channel: str | None = Field("csv", max_length=50)
    rows: list[dict[str, Any]] = Field(..., min_length=1, max_length=5000)


class WebhookImportBody(BaseModel):
    """Enregistrement unique reçu via webhook social inbound."""

    source_type: SourceTypeLiteral = "social"
    source_channel: str | None = Field(None, max_length=50)
    external_id: str | None = Field(None, max_length=255)
    payload: dict[str, Any]


class ImportSummary(BaseModel):
    imported: int
    duplicates: int
    rejected: int


# ── Enveloppes standard {success, data, meta} ──────────────────────────────


class SourceImportListOut(BaseModel):
    success: bool = True
    data: list[SourceImportOut]
    meta: dict[str, Any]


class SourceImportItemOut(BaseModel):
    success: bool = True
    data: SourceImportOut


class ImportSummaryOut(BaseModel):
    success: bool = True
    data: ImportSummary
