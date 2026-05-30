"""Router FastAPI — Tenants (profil locataire / candidat + KYC)."""
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.models.audit_log import AuditLog
from app.models.party_tenant import TenantProfile
from app.routers.tenants.schemas import (
    KycReject,
    KycReport,
    KycReportOut,
    TenantCreate,
    TenantDetailOut,
    TenantListOut,
    TenantOut,
    TenantStatusChange,
    TenantUpdate,
)
from app.routers.tenants.service import (
    change_lifecycle_status,
    create_tenant,
    delete_tenant,
    get_tenant,
    is_kyc_complete,
    is_valid_kyc_transition,
    kyc_status_report,
    list_tenants,
    set_kyc_status,
    tenant_document_types,
    update_tenant,
)

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "tenants", "status": "ok"}


@router.get("/", response_model=TenantListOut)
async def list_tenants_endpoint(
    lifecycle_status: str | None = Query(
        None, pattern="^(candidate|active|former|blacklisted)$"
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> TenantListOut:
    company_id = await get_company_id(db)
    tenants, total = await list_tenants(db, company_id, page, limit, lifecycle_status)
    return TenantListOut(
        data=[TenantOut.model_validate(t) for t in tenants],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=TenantDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def create_tenant_endpoint(
    body: TenantCreate,
    db: AsyncSession = Depends(get_db_session),
) -> TenantDetailOut:
    company_id = await get_company_id(db)
    tenant = await create_tenant(db, company_id, body)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="party_not_found_or_tenant_exists",
        )
    return TenantDetailOut(data=TenantOut.model_validate(tenant))


@router.get("/{party_id}", response_model=TenantDetailOut)
async def get_tenant_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> TenantDetailOut:
    company_id = await get_company_id(db)
    tenant = await get_tenant(db, company_id, party_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="tenant_not_found"
        )
    return TenantDetailOut(data=TenantOut.model_validate(tenant))


@router.patch(
    "/{party_id}",
    response_model=TenantDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def update_tenant_endpoint(
    party_id: uuid.UUID,
    body: TenantUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> TenantDetailOut:
    company_id = await get_company_id(db)
    tenant = await update_tenant(db, company_id, party_id, body)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="tenant_not_found"
        )
    return TenantDetailOut(data=TenantOut.model_validate(tenant))


@router.post(
    "/{party_id}/status",
    response_model=TenantDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def change_status_endpoint(
    party_id: uuid.UUID,
    body: TenantStatusChange,
    db: AsyncSession = Depends(get_db_session),
) -> TenantDetailOut:
    """Transition de cycle de vie (candidate → active → former, etc.)."""
    company_id = await get_company_id(db)
    result = await change_lifecycle_status(
        db, company_id, party_id, body.target_status, body.reason
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="tenant_not_found"
        )
    if result == "invalid_transition":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid_lifecycle_transition",
        )
    return TenantDetailOut(data=TenantOut.model_validate(result))


@router.delete(
    "/{party_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def delete_tenant_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await delete_tenant(db, company_id, party_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="tenant_not_found"
        )


# ─── KYC — vérification d'identité (M4) ────────────────────────────────────


async def _kyc_audit(
    db: AsyncSession, request: Request, company_id: uuid.UUID,
    party_id: uuid.UUID, action: str, changes: dict[str, Any],
) -> None:
    raw_user = getattr(request.state, "user_id", None)
    db.add(
        AuditLog(
            company_id=company_id,
            user_id=uuid.UUID(raw_user) if raw_user else None,
            user_email=getattr(request.state, "email", None),
            action=action,
            resource="tenant",
            resource_id=party_id,
            changes=changes,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()


async def _get_tenant_or_404(
    db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID
) -> TenantProfile:
    tenant = await get_tenant(db, company_id, party_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="tenant_not_found"
        )
    return tenant


@router.get("/{party_id}/kyc", response_model=KycReportOut)
async def kyc_report_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> KycReportOut:
    company_id = await get_company_id(db)
    tenant = await _get_tenant_or_404(db, company_id, party_id)
    today = datetime.now(timezone.utc).date()
    report = await kyc_status_report(db, company_id, tenant, today)
    return KycReportOut(data=KycReport(**report))


@router.post(
    "/{party_id}/kyc/submit",
    response_model=TenantDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def kyc_submit_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> TenantDetailOut:
    """Soumet le KYC pour revue (not_started/rejected → pending). Refuse si pièces
    manquantes."""
    company_id = await get_company_id(db)
    tenant = await _get_tenant_or_404(db, company_id, party_id)
    if not is_valid_kyc_transition(tenant.kyc_status, "pending"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="invalid_kyc_transition"
        )
    today = datetime.now(timezone.utc).date()
    present = await tenant_document_types(db, company_id, party_id)
    if not is_kyc_complete(
        present_doc_types=present,
        emirates_id=tenant.emirates_id,
        passport_number=tenant.passport_number,
        visa_number=tenant.visa_number,
        today=today,
        emirates_id_expiry=tenant.emirates_id_expiry,
        passport_expiry=tenant.passport_expiry,
        visa_expiry=tenant.visa_expiry,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="kyc_incomplete",
        )
    tenant = await set_kyc_status(db, company_id, tenant, "pending")
    return TenantDetailOut(data=TenantOut.model_validate(tenant))


@router.post(
    "/{party_id}/kyc/verify",
    response_model=TenantDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def kyc_verify_endpoint(
    party_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TenantDetailOut:
    company_id = await get_company_id(db)
    tenant = await _get_tenant_or_404(db, company_id, party_id)
    if not is_valid_kyc_transition(tenant.kyc_status, "verified"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="invalid_kyc_transition"
        )
    raw_user = getattr(request.state, "user_id", None)
    verifier = uuid.UUID(raw_user) if raw_user else None
    tenant = await set_kyc_status(
        db, company_id, tenant, "verified", verified_by_user_id=verifier
    )
    await _kyc_audit(
        db, request, company_id, party_id, "tenant.kyc_verified", {"kyc_status": "verified"}
    )
    return TenantDetailOut(data=TenantOut.model_validate(tenant))


@router.post(
    "/{party_id}/kyc/reject",
    response_model=TenantDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def kyc_reject_endpoint(
    party_id: uuid.UUID,
    body: KycReject,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TenantDetailOut:
    company_id = await get_company_id(db)
    tenant = await _get_tenant_or_404(db, company_id, party_id)
    if not is_valid_kyc_transition(tenant.kyc_status, "rejected"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="invalid_kyc_transition"
        )
    tenant = await set_kyc_status(
        db, company_id, tenant, "rejected", rejection_reason=body.reason
    )
    await _kyc_audit(
        db, request, company_id, party_id, "tenant.kyc_rejected",
        {"kyc_status": "rejected", "reason": body.reason},
    )
    return TenantDetailOut(data=TenantOut.model_validate(tenant))
