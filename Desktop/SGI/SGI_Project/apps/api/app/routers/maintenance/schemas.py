"""Schémas Pydantic v2 — module Maintenance (Phase 1 + Phase 2)."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ── Constantes de validation ─────────────────────────────────────────────

VALID_CATEGORIES = (
    "plumbing", "electrical", "hvac", "appliance",
    "structural", "cleaning", "other",
)
VALID_PRIORITIES = ("low", "medium", "high", "urgent")
VALID_STATUSES = (
    "new", "triaged", "assigned", "in_progress",
    "on_hold", "resolved", "closed", "cancelled",
)
VALID_REPORTER_ROLES = ("tenant", "owner", "agent", "system")

CATEGORY_PATTERN  = "^(plumbing|electrical|hvac|appliance|structural|cleaning|other)$"
PRIORITY_PATTERN  = "^(low|medium|high|urgent)$"
STATUS_PATTERN    = "^(new|triaged|assigned|in_progress|on_hold|resolved|closed|cancelled)$"


# ── Création ─────────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str | None = Field(None, max_length=5000)
    category: str = Field(..., pattern=CATEGORY_PATTERN)
    priority: str = Field("medium", pattern=PRIORITY_PATTERN)
    # Au moins l'un des deux doit être fourni (validé aussi côté DB).
    unit_id: uuid.UUID | None = None
    building_id: uuid.UUID | None = None
    reporter_role: str = Field("agent", pattern="^(tenant|owner|agent|system)$")
    cost_estimate_aed: Decimal | None = Field(None, gt=0, decimal_places=2)


# ── Mise à jour partielle ────────────────────────────────────────────────

class TicketUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=255)
    description: str | None = None
    category: str | None = Field(None, pattern=CATEGORY_PATTERN)
    priority: str | None = Field(None, pattern=PRIORITY_PATTERN)
    cost_estimate_aed: Decimal | None = Field(None, gt=0, decimal_places=2)
    cost_final_aed: Decimal | None = Field(None, gt=0, decimal_places=2)


# ── Assignation ──────────────────────────────────────────────────────────

class TicketAssign(BaseModel):
    """Assign un technicien interne OU un vendor externe — pas les deux."""
    technician_id: uuid.UUID | None = None
    vendor_party_id: uuid.UUID | None = None


# ── Changement de statut ─────────────────────────────────────────────────

class TicketStatusUpdate(BaseModel):
    status: str = Field(..., pattern=STATUS_PATTERN)
    reason: str | None = Field(None, max_length=500)


# ── Output ───────────────────────────────────────────────────────────────

class TicketOut(BaseModel):
    id: uuid.UUID
    reference: str
    company_id: uuid.UUID
    unit_id: uuid.UUID | None
    building_id: uuid.UUID | None
    reported_by_user_id: uuid.UUID
    reporter_role: str
    category: str
    priority: str
    status: str
    title: str
    description: str | None
    assigned_technician_id: uuid.UUID | None
    assigned_vendor_party_id: uuid.UUID | None
    vendor_mission_id: uuid.UUID | None
    sla_due_at: datetime | None
    resolved_at: datetime | None
    cost_estimate_aed: Decimal | None
    cost_final_aed: Decimal | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketListOut(BaseModel):
    success: bool = True
    data: list[TicketOut]
    meta: dict[str, Any]


class TicketDetailOut(BaseModel):
    success: bool = True
    data: TicketOut


# ── Phase 2 : Devis (Quote) ───────────────────────────────────────────────

class QuoteCreate(BaseModel):
    vendor_party_id: uuid.UUID
    amount_aed: Decimal = Field(..., gt=0, decimal_places=2)
    valid_until: date | None = None
    notes: str | None = Field(None, max_length=2000)


class QuoteOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    vendor_party_id: uuid.UUID
    amount_aed: Decimal
    valid_until: date | None
    status: str
    notes: str | None
    file_key: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Phase 2 : Facture (Invoice) ───────────────────────────────────────────

class InvoiceCreate(BaseModel):
    vendor_party_id: uuid.UUID
    amount_aed: Decimal = Field(..., gt=0, decimal_places=2)
    due_date: date | None = None


class InvoiceOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    vendor_party_id: uuid.UUID
    amount_aed: Decimal
    status: str
    due_date: date | None
    finance_transaction_id: uuid.UUID | None
    file_key: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Phase 2 : Plan préventif (Plan) ──────────────────────────────────────

class PlanCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    category: str = Field(..., pattern=CATEGORY_PATTERN)
    priority: str = Field("medium", pattern=PRIORITY_PATTERN)
    cron_expression: str = Field(..., min_length=5, max_length=100)
    unit_id: uuid.UUID | None = None
    building_id: uuid.UUID | None = None


class PlanUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=255)
    category: str | None = Field(None, pattern=CATEGORY_PATTERN)
    priority: str | None = Field(None, pattern=PRIORITY_PATTERN)
    cron_expression: str | None = Field(None, min_length=5, max_length=100)
    active: bool | None = None


class PlanOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    unit_id: uuid.UUID | None
    building_id: uuid.UUID | None
    title: str
    category: str
    priority: str
    cron_expression: str
    next_due_at: datetime | None
    last_generated_at: datetime | None
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Phase 2 : Calendrier ─────────────────────────────────────────────────

class CalendarEntry(BaseModel):
    """Un élément du calendrier maintenance (SLA à venir ou préventif planifié)."""
    kind: str            # "sla" | "preventive"
    ticket_id: uuid.UUID | None = None
    plan_id: uuid.UUID | None = None
    reference: str | None = None
    title: str
    priority: str
    due_at: datetime
    is_breached: bool = False


class CalendarOut(BaseModel):
    success: bool = True
    data: list[CalendarEntry]
    meta: dict[str, Any]
