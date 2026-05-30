"""Router FastAPI — Immobilier Core (branches + company settings)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.realestate_core.schemas import (
    BranchCreate,
    BranchDetailOut,
    BranchListOut,
    BranchOut,
    BranchUpdate,
    CompanySettingsOut,
    CompanySettingsResponse,
    CompanySettingsUpdate,
)
from app.routers.realestate_core.service import (
    create_branch,
    delete_branch,
    get_branch,
    get_or_create_settings,
    list_branches,
    update_branch,
    update_settings,
)

router = APIRouter(tags=["realestate-core"])


@router.get("/realestate-core/health")
async def health() -> dict[str, str]:
    return {"module": "realestate_core", "status": "ok"}


# ─── Branches ──────────────────────────────────────────────────────────────


@router.get("/branches", response_model=BranchListOut)
async def list_branches_endpoint(
    emirate: str | None = Query(None, pattern="^(DXB|AUH|SHJ|AJM|RAK|FUJ|UAQ)$"),
    is_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BranchListOut:
    company_id = await get_company_id(db)
    branches, total = await list_branches(
        db, company_id, page, limit, emirate, is_active
    )
    return BranchListOut(
        data=[BranchOut.model_validate(b) for b in branches],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/branches",
    response_model=BranchDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def create_branch_endpoint(
    body: BranchCreate,
    db: AsyncSession = Depends(get_db_session),
) -> BranchDetailOut:
    company_id = await get_company_id(db)
    branch = await create_branch(db, company_id, body)
    return BranchDetailOut(data=BranchOut.model_validate(branch))


@router.get("/branches/{branch_id}", response_model=BranchDetailOut)
async def get_branch_endpoint(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> BranchDetailOut:
    company_id = await get_company_id(db)
    branch = await get_branch(db, company_id, branch_id)
    if branch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="branch_not_found"
        )
    return BranchDetailOut(data=BranchOut.model_validate(branch))


@router.patch(
    "/branches/{branch_id}",
    response_model=BranchDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def update_branch_endpoint(
    branch_id: uuid.UUID,
    body: BranchUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> BranchDetailOut:
    company_id = await get_company_id(db)
    branch = await update_branch(db, company_id, branch_id, body)
    if branch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="branch_not_found"
        )
    return BranchDetailOut(data=BranchOut.model_validate(branch))


@router.delete(
    "/branches/{branch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
async def delete_branch_endpoint(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await delete_branch(db, company_id, branch_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="branch_not_found"
        )


# ─── Company settings (singleton par tenant) ───────────────────────────────


@router.get("/company-settings", response_model=CompanySettingsResponse)
async def get_settings_endpoint(
    db: AsyncSession = Depends(get_db_session),
) -> CompanySettingsResponse:
    company_id = await get_company_id(db)
    settings = await get_or_create_settings(db, company_id)
    return CompanySettingsResponse(data=CompanySettingsOut.model_validate(settings))


@router.put(
    "/company-settings",
    response_model=CompanySettingsResponse,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def update_settings_endpoint(
    body: CompanySettingsUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> CompanySettingsResponse:
    company_id = await get_company_id(db)
    settings = await update_settings(db, company_id, body)
    return CompanySettingsResponse(data=CompanySettingsOut.model_validate(settings))
