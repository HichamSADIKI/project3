"""Router FastAPI — Tenants (profil locataire / candidat)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.tenants.schemas import (
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
    list_tenants,
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
