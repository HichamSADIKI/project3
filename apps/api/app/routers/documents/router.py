"""Router FastAPI — Documents & Signature."""

import uuid
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.models.audit_log import AuditLog
from app.routers.documents import service
from app.routers.documents.schemas import (
    DocumentCreate,
    DocumentDetail,
    DocumentDetailOut,
    DocumentListOut,
    DocumentOut,
    DocumentSignatureOut,
    DocumentUpdate,
    DocumentVersionListOut,
    DocumentVersionOut,
    DocumentVersionResponse,
    SignatureListOut,
    SignatureRequest,
    SignatureResponse,
    SignatureSign,
)
from app.routers.iam.assurance_deps import require_assurance

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_DOC_BYTES = 20 * 1024 * 1024  # 20 Mo


def _client_ctx(request: Request) -> tuple[uuid.UUID | None, str | None, str | None, str | None]:
    """(user_id, user_email, ip, user_agent) depuis la requête (audit)."""
    raw_user = getattr(request.state, "user_id", None)
    user_id = uuid.UUID(raw_user) if raw_user else None
    email = getattr(request.state, "email", None)
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return user_id, email, ip, ua


async def _audit(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    user_email: str | None,
    action: str,
    resource_id: uuid.UUID,
    changes: dict[str, Any],
    ip: str | None,
    ua: str | None,
) -> None:
    db.add(
        AuditLog(
            company_id=company_id,
            user_id=user_id,
            user_email=user_email,
            action=action,
            resource="document",
            resource_id=resource_id,
            changes=changes,
            ip_address=ip,
            user_agent=ua,
        )
    )
    await db.commit()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "documents", "status": "ok"}


# ─── Documents ─────────────────────────────────────────────────────────────


@router.get("/", response_model=DocumentListOut)
async def list_documents_endpoint(
    entity_type: str | None = Query(None, max_length=40),
    entity_id: uuid.UUID | None = Query(None),
    doc_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentListOut:
    company_id = await get_company_id(db)
    docs, total = await service.list_documents(
        db, company_id, page, limit, entity_type, entity_id, doc_type, status_filter
    )
    return DocumentListOut(
        data=[DocumentOut.model_validate(d) for d in docs],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=DocumentDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def create_document_endpoint(
    body: DocumentCreate,
    db: AsyncSession = Depends(get_db_session),
) -> DocumentDetailOut:
    company_id = await get_company_id(db)
    doc = await service.create_document(db, company_id, body)
    return DocumentDetailOut(data=DocumentDetail.model_validate(doc))


@router.get("/{document_id}", response_model=DocumentDetailOut)
async def get_document_endpoint(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> DocumentDetailOut:
    company_id = await get_company_id(db)
    doc = await service.get_document(db, company_id, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_found")
    versions = await service.list_versions(db, company_id, document_id)
    signatures = await service.list_signatures(db, company_id, document_id)
    detail = DocumentDetail.model_validate(doc)
    detail.versions = [DocumentVersionOut.model_validate(v) for v in versions]
    detail.signatures = [DocumentSignatureOut.model_validate(s) for s in signatures]
    return DocumentDetailOut(data=detail)


@router.patch(
    "/{document_id}",
    response_model=DocumentDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def update_document_endpoint(
    document_id: uuid.UUID,
    body: DocumentUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> DocumentDetailOut:
    company_id = await get_company_id(db)
    doc = await service.update_document(db, company_id, document_id, body)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_found")
    return DocumentDetailOut(data=DocumentDetail.model_validate(doc))


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def delete_document_endpoint(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await service.delete_document(db, company_id, document_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_found")


# ─── Versions ──────────────────────────────────────────────────────────────


@router.get("/{document_id}/versions", response_model=DocumentVersionListOut)
async def list_versions_endpoint(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> DocumentVersionListOut:
    company_id = await get_company_id(db)
    doc = await service.get_document(db, company_id, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_found")
    versions = await service.list_versions(db, company_id, document_id)
    return DocumentVersionListOut(
        data=[DocumentVersionOut.model_validate(v) for v in versions],
        meta={"total": len(versions)},
    )


@router.post(
    "/{document_id}/versions",
    response_model=DocumentVersionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def upload_version_endpoint(
    document_id: uuid.UUID,
    request: Request,
    notes: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentVersionResponse:
    company_id = await get_company_id(db)
    doc = await service.get_document(db, company_id, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_found")

    content_type = file.content_type or ""
    ext = service.extension_for_doc_mime(content_type)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="unsupported_document_type",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="empty_file")
    if len(data) > MAX_DOC_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="file_too_large"
        )

    sha256 = service.compute_sha256(data)
    existing = await service.list_versions(db, company_id, document_id)
    version_number = service.next_version_number([v.version_number for v in existing])
    key = service.build_document_key(company_id, document_id, version_number, ext)
    try:
        file_path = await storage.upload_bytes(key, data, content_type)
    except storage.StorageError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="storage_unavailable"
        ) from None

    user_id, _email, _ip, _ua = _client_ctx(request)
    version = await service.add_version(
        db,
        company_id,
        doc,
        file_path=file_path,
        sha256=sha256,
        original_filename=file.filename,
        content_type=content_type,
        size_bytes=len(data),
        uploaded_by_user_id=user_id,
        notes=notes,
    )
    url = await storage.presigned_url(version.file_path)
    return DocumentVersionResponse(data=DocumentVersionOut.model_validate(version), url=url)


@router.get("/{document_id}/versions/{version_id}/download")
async def download_version_endpoint(
    document_id: uuid.UUID,
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    company_id = await get_company_id(db)
    version = await service.get_version(db, company_id, version_id)
    if version is None or version.document_id != document_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="version_not_found")
    url = await storage.presigned_url(version.file_path)
    if url is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="storage_unavailable"
        )
    return {"success": True, "data": {"url": url}}


# ─── Signatures ────────────────────────────────────────────────────────────


@router.get("/{document_id}/signatures", response_model=SignatureListOut)
async def list_signatures_endpoint(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> SignatureListOut:
    company_id = await get_company_id(db)
    doc = await service.get_document(db, company_id, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_found")
    sigs = await service.list_signatures(db, company_id, document_id)
    return SignatureListOut(
        data=[DocumentSignatureOut.model_validate(s) for s in sigs],
        meta={"total": len(sigs)},
    )


@router.post(
    "/{document_id}/signatures",
    response_model=SignatureResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def request_signature_endpoint(
    document_id: uuid.UUID,
    body: SignatureRequest,
    db: AsyncSession = Depends(get_db_session),
) -> SignatureResponse:
    company_id = await get_company_id(db)
    doc = await service.get_document(db, company_id, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_found")
    if doc.current_version_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="document_has_no_version")
    sig = await service.request_signature(db, company_id, doc, doc.current_version_id, body)
    return SignatureResponse(data=DocumentSignatureOut.model_validate(sig))


@router.post(
    "/{document_id}/signatures/{signature_id}/sign",
    response_model=SignatureResponse,
    # Enforcement assurance « UAE PASS Infinity » : apposer une signature exige une
    # signature avancée → niveau L2 requis (action `sign_document`). 403 structuré
    # sinon, pour permettre le step-up côté client. La signature qualifiée (L3) est
    # servie par l'endpoint dédié `iam/assurance/sign`.
    dependencies=[Depends(require_assurance("sign_document"))],
)
async def sign_signature_endpoint(
    document_id: uuid.UUID,
    signature_id: uuid.UUID,
    body: SignatureSign,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SignatureResponse:
    company_id = await get_company_id(db)
    sig = await service.get_signature(db, company_id, signature_id)
    if sig is None or sig.document_id != document_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="signature_not_found")
    if not service.is_valid_signature_transition(sig.status, "signed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="invalid_signature_transition"
        )
    version = await service.get_version(db, company_id, sig.document_version_id)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="version_not_found")

    user_id, email, ip, ua = _client_ctx(request)
    sig = await service.sign_signature(
        db,
        company_id,
        sig,
        version.sha256,
        method=body.method,
        otp_verified=body.otp_verified,
        ip_address=ip,
        user_agent=ua,
    )
    await _audit(
        db,
        company_id=company_id,
        user_id=user_id,
        user_email=email,
        action="document.signed",
        resource_id=document_id,
        changes={"signature_id": str(sig.id), "hash": sig.signature_hash},
        ip=ip,
        ua=ua,
    )
    return SignatureResponse(data=DocumentSignatureOut.model_validate(sig))


@router.post(
    "/{document_id}/signatures/{signature_id}/decline",
    response_model=SignatureResponse,
)
async def decline_signature_endpoint(
    document_id: uuid.UUID,
    signature_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SignatureResponse:
    company_id = await get_company_id(db)
    sig = await service.get_signature(db, company_id, signature_id)
    if sig is None or sig.document_id != document_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="signature_not_found")
    if not service.is_valid_signature_transition(sig.status, "declined"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="invalid_signature_transition"
        )
    sig = await service.decline_signature(db, sig)
    user_id, email, ip, ua = _client_ctx(request)
    await _audit(
        db,
        company_id=company_id,
        user_id=user_id,
        user_email=email,
        action="document.declined",
        resource_id=document_id,
        changes={"signature_id": str(sig.id)},
        ip=ip,
        ua=ua,
    )
    return SignatureResponse(data=DocumentSignatureOut.model_validate(sig))
