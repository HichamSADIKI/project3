import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class GoldenVisaCreate(BaseModel):
    client_id: uuid.UUID
    property_id: Optional[uuid.UUID] = None
    contract_id: Optional[uuid.UUID] = None
    application_number: Optional[str] = None
    status: str = "pending"
    passport_doc: Optional[str] = None
    dld_doc: Optional[str] = None
    gdrfa_doc: Optional[str] = None
    insurance_doc: Optional[str] = None
    biometric_photo: Optional[str] = None
    submission_date: Optional[date] = None
    approval_date: Optional[date] = None
    visa_expiry_date: Optional[date] = None
    notes: Optional[str] = None
    assigned_agent_id: Optional[uuid.UUID] = None


class GoldenVisaUpdate(BaseModel):
    application_number: Optional[str] = None
    status: Optional[str] = None
    passport_doc: Optional[str] = None
    dld_doc: Optional[str] = None
    gdrfa_doc: Optional[str] = None
    insurance_doc: Optional[str] = None
    biometric_photo: Optional[str] = None
    submission_date: Optional[date] = None
    approval_date: Optional[date] = None
    visa_expiry_date: Optional[date] = None
    notes: Optional[str] = None
    assigned_agent_id: Optional[uuid.UUID] = None


class GoldenVisaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    client_id: uuid.UUID
    property_id: Optional[uuid.UUID]
    contract_id: Optional[uuid.UUID]
    application_number: Optional[str]
    status: str
    passport_doc: Optional[str]
    dld_doc: Optional[str]
    gdrfa_doc: Optional[str]
    insurance_doc: Optional[str]
    biometric_photo: Optional[str]
    submission_date: Optional[date]
    approval_date: Optional[date]
    visa_expiry_date: Optional[date]
    alert_90_sent: bool
    alert_30_sent: bool
    notes: Optional[str]
    assigned_agent_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class GoldenVisaListOut(BaseModel):
    success: bool = True
    data: list[GoldenVisaOut]
    meta: dict


class GoldenVisaDetailOut(BaseModel):
    success: bool = True
    data: GoldenVisaOut
