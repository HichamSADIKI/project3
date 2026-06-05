"""Router FastAPI — Vendors (prestataires externes)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.vendors.schemas import (
    VendorCreate,
    VendorDetailOut,
    VendorListOut,
    VendorOut,
    VendorRatingInput,
    VendorsSummaryOut,
    VendorUpdate,
)
from app.routers.vendors.service import (
    add_rating,
    create_vendor,
    delete_vendor,
    get_vendor,
    list_vendors,
    update_vendor,
    vendors_summary,
)

router = APIRouter(prefix="/vendors", tags=["fournisseurs"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "vendors", "status": "ok"}


@router.get("/", response_model=VendorListOut)
async def list_vendors_endpoint(
    vendor_type: str | None = Query(None),
    is_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> VendorListOut:
    company_id = await get_company_id(db)
    vendors, total = await list_vendors(db, company_id, page, limit, vendor_type, is_active)
    return VendorListOut(
        data=[VendorOut.model_validate(v) for v in vendors],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=VendorDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def create_vendor_endpoint(
    body: VendorCreate,
    db: AsyncSession = Depends(get_db_session),
) -> VendorDetailOut:
    company_id = await get_company_id(db)
    vendor = await create_vendor(db, company_id, body)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="party_not_found_or_vendor_exists",
        )
    return VendorDetailOut(data=VendorOut.model_validate(vendor))


@router.get("/summary", response_model=VendorsSummaryOut)
async def vendors_summary_endpoint(
    db: AsyncSession = Depends(get_db_session),
) -> VendorsSummaryOut:
    """Synthèse de l'annuaire fournisseurs : répartition par type et par statut de
    vérification, nombre d'actifs et de vérifiés."""
    company_id = await get_company_id(db)
    summary = await vendors_summary(db, company_id)
    return VendorsSummaryOut(data=summary, meta={})


@router.get("/{party_id}", response_model=VendorDetailOut)
async def get_vendor_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> VendorDetailOut:
    company_id = await get_company_id(db)
    vendor = await get_vendor(db, company_id, party_id)
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor_not_found")
    return VendorDetailOut(data=VendorOut.model_validate(vendor))


@router.patch(
    "/{party_id}",
    response_model=VendorDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def update_vendor_endpoint(
    party_id: uuid.UUID,
    body: VendorUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> VendorDetailOut:
    company_id = await get_company_id(db)
    vendor = await update_vendor(db, company_id, party_id, body)
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor_not_found")
    return VendorDetailOut(data=VendorOut.model_validate(vendor))


@router.post(
    "/{party_id}/ratings",
    response_model=VendorDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def rate_vendor_endpoint(
    party_id: uuid.UUID,
    body: VendorRatingInput,
    db: AsyncSession = Depends(get_db_session),
) -> VendorDetailOut:
    """Ajoute une note 0-5. Met à jour la moyenne cumulée."""
    company_id = await get_company_id(db)
    vendor = await add_rating(db, company_id, party_id, body.score)
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor_not_found")
    return VendorDetailOut(data=VendorOut.model_validate(vendor))


@router.delete(
    "/{party_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def delete_vendor_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await delete_vendor(db, company_id, party_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor_not_found")
