"""Schémas Pydantic v2 — Documents & Signature."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

DocType = Literal[
    "contract",
    "mandate",
    "id",
    "passport",
    "ejari",
    "dld",
    "insurance",
    "invoice",
    "statement",
    "other",
]
DocumentStatus = Literal["draft", "active", "signed", "archived"]
SignerRole = Literal["owner", "tenant", "agent", "witness", "other"]
SignatureMethod = Literal["otp", "typed", "drawn", "click_to_sign"]


# ─── Documents ─────────────────────────────────────────────────────────────


class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    doc_type: DocType = "other"
    entity_type: str | None = Field(None, max_length=40)
    entity_id: uuid.UUID | None = None
    description: str | None = None
    tags: list[str] = Field(default_factory=list)


class DocumentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    doc_type: DocType | None = None
    entity_type: str | None = Field(None, max_length=40)
    entity_id: uuid.UUID | None = None
    status: DocumentStatus | None = None
    description: str | None = None
    tags: list[str] | None = None


class DocumentVersionOut(BaseModel):
    id: uuid.UUID
    version_number: int
    original_filename: str | None
    content_type: str | None
    size_bytes: int
    sha256: str
    uploaded_by_user_id: uuid.UUID | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentSignatureOut(BaseModel):
    id: uuid.UUID
    document_version_id: uuid.UUID
    signer_party_id: uuid.UUID | None
    signer_user_id: uuid.UUID | None
    signer_name: str
    signer_email: str | None
    signer_role: str
    status: str
    signature_hash: str | None
    method: str | None
    otp_verified: bool
    provider: str
    order_index: int
    signed_at: datetime | None
    declined_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: uuid.UUID
    title: str
    doc_type: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    status: str
    current_version_id: uuid.UUID | None
    description: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentDetail(DocumentOut):
    versions: list[DocumentVersionOut] = Field(default_factory=list)
    signatures: list[DocumentSignatureOut] = Field(default_factory=list)


class DocumentListOut(BaseModel):
    success: bool = True
    data: list[DocumentOut]
    meta: dict[str, Any]


class DocumentDetailOut(BaseModel):
    success: bool = True
    data: DocumentDetail


class DocumentVersionResponse(BaseModel):
    success: bool = True
    data: DocumentVersionOut
    url: str | None = None


class DocumentVersionListOut(BaseModel):
    success: bool = True
    data: list[DocumentVersionOut]
    meta: dict[str, Any]


# ─── Signatures ────────────────────────────────────────────────────────────


class SignatureRequest(BaseModel):
    signer_name: str = Field(..., min_length=1, max_length=200)
    signer_email: EmailStr | None = None
    signer_role: SignerRole = "other"
    signer_party_id: uuid.UUID | None = None
    signer_user_id: uuid.UUID | None = None
    order_index: int = Field(0, ge=0)


class SignatureSign(BaseModel):
    method: SignatureMethod = "click_to_sign"
    otp_verified: bool = False


class SignatureResponse(BaseModel):
    success: bool = True
    data: DocumentSignatureOut


class SignatureListOut(BaseModel):
    success: bool = True
    data: list[DocumentSignatureOut]
    meta: dict[str, Any]
