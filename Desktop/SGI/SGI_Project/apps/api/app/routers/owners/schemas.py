"""Schémas Pydantic v2 — Owners (profil propriétaire)."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

PayoutMethod = Literal["bank_transfer", "cheque", "cash"]


class OwnerCreate(BaseModel):
    """Création d'un profil owner — lié à un client existant via party_id."""

    party_id: uuid.UUID = Field(..., description="ID du Client (table parapluie)")
    residency_uae: bool = False

    emirates_id: str | None = Field(None, max_length=50)
    emirates_id_expiry: date | None = None
    passport_number: str | None = Field(None, max_length=50)
    passport_expiry: date | None = None

    mandate_reference: str | None = Field(None, max_length=50)
    mandate_signed_at: datetime | None = None
    mandate_start_date: date | None = None
    mandate_end_date: date | None = None
    mandate_commission_rate: Decimal | None = Field(None, ge=0, le=100)
    mandate_document_path: str | None = Field(None, max_length=500)

    bank_iban: str | None = Field(None, max_length=50)
    bank_swift: str | None = Field(None, max_length=20)
    bank_name: str | None = Field(None, max_length=200)
    preferred_payout_method: PayoutMethod = "bank_transfer"

    monthly_statement_enabled: bool = True
    expense_approval_threshold_aed: Decimal | None = Field(None, ge=0)

    @model_validator(mode="after")
    def check_mandate_dates(self) -> "OwnerCreate":
        if (
            self.mandate_start_date
            and self.mandate_end_date
            and self.mandate_end_date < self.mandate_start_date
        ):
            raise ValueError("mandate_end_date must be on or after mandate_start_date")
        return self


class OwnerUpdate(BaseModel):
    """Mise à jour partielle — tous les champs optionnels."""

    residency_uae: bool | None = None
    emirates_id: str | None = None
    emirates_id_expiry: date | None = None
    passport_number: str | None = None
    passport_expiry: date | None = None

    mandate_reference: str | None = None
    mandate_signed_at: datetime | None = None
    mandate_start_date: date | None = None
    mandate_end_date: date | None = None
    mandate_commission_rate: Decimal | None = Field(None, ge=0, le=100)
    mandate_document_path: str | None = None

    bank_iban: str | None = None
    bank_swift: str | None = None
    bank_name: str | None = None
    preferred_payout_method: PayoutMethod | None = None

    monthly_statement_enabled: bool | None = None
    expense_approval_threshold_aed: Decimal | None = Field(None, ge=0)


class OwnerOut(BaseModel):
    party_id: uuid.UUID
    residency_uae: bool
    emirates_id: str | None
    emirates_id_expiry: date | None
    passport_number: str | None
    passport_expiry: date | None
    mandate_reference: str | None
    mandate_signed_at: datetime | None
    mandate_start_date: date | None
    mandate_end_date: date | None
    mandate_commission_rate: Decimal | None
    mandate_document_path: str | None
    bank_iban: str | None
    bank_swift: str | None
    bank_name: str | None
    preferred_payout_method: str
    monthly_statement_enabled: bool
    expense_approval_threshold_aed: Decimal | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OwnerListOut(BaseModel):
    success: bool = True
    data: list[OwnerOut]
    meta: dict[str, Any]


class OwnerDetailOut(BaseModel):
    success: bool = True
    data: OwnerOut
