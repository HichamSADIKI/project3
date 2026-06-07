import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class GoldenVisaCreate(BaseModel):
    client_id: uuid.UUID
    property_id: uuid.UUID | None = None
    contract_id: uuid.UUID | None = None
    application_number: str | None = None
    status: str = "pending"
    passport_doc: str | None = None
    dld_doc: str | None = None
    gdrfa_doc: str | None = None
    insurance_doc: str | None = None
    biometric_photo: str | None = None
    submission_date: date | None = None
    approval_date: date | None = None
    visa_expiry_date: date | None = None
    notes: str | None = None
    assigned_agent_id: uuid.UUID | None = None


class GoldenVisaUpdate(BaseModel):
    application_number: str | None = None
    status: str | None = None
    passport_doc: str | None = None
    dld_doc: str | None = None
    gdrfa_doc: str | None = None
    insurance_doc: str | None = None
    biometric_photo: str | None = None
    submission_date: date | None = None
    approval_date: date | None = None
    visa_expiry_date: date | None = None
    notes: str | None = None
    assigned_agent_id: uuid.UUID | None = None


class GoldenVisaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    client_id: uuid.UUID
    property_id: uuid.UUID | None
    contract_id: uuid.UUID | None
    application_number: str | None
    status: str
    passport_doc: str | None
    dld_doc: str | None
    gdrfa_doc: str | None
    insurance_doc: str | None
    biometric_photo: str | None
    submission_date: date | None
    approval_date: date | None
    visa_expiry_date: date | None
    alert_90_sent: bool
    alert_30_sent: bool
    notes: str | None
    assigned_agent_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class GoldenVisaListOut(BaseModel):
    success: bool = True
    data: list[GoldenVisaOut]
    meta: dict


class GoldenVisaDetailOut(BaseModel):
    success: bool = True
    data: GoldenVisaOut


class DocumentItem(BaseModel):
    doc_type: str
    label: str
    present: bool
    status: str  # missing | pending | approved | rejected
    notes: str | None = None


class DocumentChecklist(BaseModel):
    required: list[str]
    present: list[str]
    missing: list[str]
    readiness_pct: int
    ready: bool
    items: list[DocumentItem] = []
    all_approved: bool = False


class DocumentChecklistOut(BaseModel):
    success: bool = True
    data: DocumentChecklist


class DocumentReviewIn(BaseModel):
    status: str  # pending | approved | rejected
    notes: str | None = None


class GoldenVisaDocUploadOut(BaseModel):
    """Réponse d'upload d'un document : dossier mis à jour + URL présignée."""

    success: bool = True
    data: GoldenVisaOut
    url: str | None = None


class GoldenVisaDocDownloadOut(BaseModel):
    success: bool = True
    url: str
