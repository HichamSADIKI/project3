"""Schémas Pydantic v2 — PDC (post-dated cheques)."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

PdcStatus = Literal[
    "pending", "deposited", "cleared", "bounced", "replaced", "cancelled"
]


class PdcCreate(BaseModel):
    """
    Exactement un des deux liens transactionnels doit être renseigné.
    Le drawer_party_id est obligatoire (Loi UAE : traçabilité).
    """

    rental_id: uuid.UUID | None = None
    contract_id: uuid.UUID | None = None
    drawer_party_id: uuid.UUID

    cheque_number: str = Field(..., max_length=50)
    bank_name: str = Field(..., max_length=150)
    bank_branch: str | None = Field(None, max_length=150)
    account_holder_name: str = Field(..., max_length=255)
    amount_aed: Decimal = Field(..., gt=0)
    due_date: date

    document_path: str | None = None
    ocr_data: dict[str, Any] = Field(default_factory=dict)
    ocr_confidence: Decimal | None = Field(None, ge=0, le=100)

    notes: str | None = None

    @model_validator(mode="after")
    def check_exactly_one_link(self) -> "PdcCreate":
        has_rental = self.rental_id is not None
        has_contract = self.contract_id is not None
        if has_rental == has_contract:
            raise ValueError("exactly one of rental_id or contract_id must be set")
        return self


class PdcUpdate(BaseModel):
    """Mise à jour limitée — les transitions de statut passent par les actions."""

    bank_branch: str | None = None
    account_holder_name: str | None = None
    document_path: str | None = None
    ocr_data: dict[str, Any] | None = None
    ocr_confidence: Decimal | None = None
    notes: str | None = None


class PdcDepositAction(BaseModel):
    deposit_date: date


class PdcClearAction(BaseModel):
    """Aucun argument requis — passe à `cleared` à now()."""


class PdcBounceAction(BaseModel):
    bounce_reason: str = Field(..., max_length=150)
    bounce_fee_aed: Decimal = Field(Decimal("0"), ge=0)


class PdcReplaceAction(BaseModel):
    """
    Remplace un PDC bounced par un nouveau.
    Le service crée le nouveau PDC et lie l'ancien via `replaced_by_pdc_id`.
    """

    new_cheque: PdcCreate


class PdcOut(BaseModel):
    id: uuid.UUID
    reference: str
    rental_id: uuid.UUID | None
    contract_id: uuid.UUID | None
    drawer_party_id: uuid.UUID
    cheque_number: str
    bank_name: str
    bank_branch: str | None
    account_holder_name: str
    amount_aed: Decimal
    due_date: date
    deposit_date: date | None
    cleared_at: datetime | None
    bounced_at: datetime | None
    status: str
    bounce_reason: str | None
    bounce_fee_aed: Decimal
    replaced_by_pdc_id: uuid.UUID | None
    document_path: str | None
    ocr_data: dict[str, Any]
    ocr_confidence: Decimal | None
    notes: str | None
    legal_notices_sent: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PdcListOut(BaseModel):
    success: bool = True
    data: list[PdcOut]
    meta: dict[str, Any]


class PdcDetailOut(BaseModel):
    success: bool = True
    data: PdcOut


class DepositCalendarEntry(BaseModel):
    pdc_id: uuid.UUID
    reference: str
    cheque_number: str
    amount_aed: Decimal
    due_date: date
    status: str
    days_to_due: int


class DepositCalendarOut(BaseModel):
    success: bool = True
    data: list[DepositCalendarEntry]
    meta: dict[str, Any]
