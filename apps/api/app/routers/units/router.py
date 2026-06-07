"""Router FastAPI — Units."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.units.schemas import (
    OccupancySummaryOut,
    UnitCreate,
    UnitDetailOut,
    UnitListOut,
    UnitOut,
    UnitStatusChange,
    UnitUpdate,
)
from app.routers.units.service import (
    change_status,
    create_unit,
    delete_unit,
    get_unit,
    list_units,
    occupancy_summary,
    update_unit,
)

router = APIRouter(prefix="/units", tags=["units"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "units", "status": "ok"}


@router.get("/", response_model=UnitListOut)
async def list_units_endpoint(
    building_id: uuid.UUID | None = Query(None),
    floor_id: uuid.UUID | None = Query(None),
    unit_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> UnitListOut:
    company_id = await get_company_id(db)
    units, total = await list_units(
        db, company_id, page, limit, building_id, floor_id, unit_type, status_filter
    )
    return UnitListOut(
        data=[UnitOut.model_validate(u) for u in units],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=UnitDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def create_unit_endpoint(
    body: UnitCreate,
    db: AsyncSession = Depends(get_db_session),
) -> UnitDetailOut:
    company_id = await get_company_id(db)
    unit = await create_unit(db, company_id, body)
    if unit is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="building_or_floor_not_found",
        )
    return UnitDetailOut(data=UnitOut.model_validate(unit))


@router.get("/occupancy", response_model=OccupancySummaryOut)
async def occupancy_endpoint(
    building_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
) -> OccupancySummaryOut:
    """Taux d'occupation et répartition des unités par statut (option : un
    bâtiment via `building_id`). Le parc louable exclut les unités hors marché."""
    company_id = await get_company_id(db)
    summary = await occupancy_summary(db, company_id, building_id)
    return OccupancySummaryOut(
        data=summary, meta={"building_id": str(building_id) if building_id else None}
    )


@router.get("/{unit_id}", response_model=UnitDetailOut)
async def get_unit_endpoint(
    unit_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> UnitDetailOut:
    company_id = await get_company_id(db)
    unit = await get_unit(db, company_id, unit_id)
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_not_found")
    return UnitDetailOut(data=UnitOut.model_validate(unit))


@router.patch(
    "/{unit_id}",
    response_model=UnitDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def update_unit_endpoint(
    unit_id: uuid.UUID,
    body: UnitUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> UnitDetailOut:
    company_id = await get_company_id(db)
    unit = await update_unit(db, company_id, unit_id, body)
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_not_found")
    return UnitDetailOut(data=UnitOut.model_validate(unit))


@router.post(
    "/{unit_id}/status",
    response_model=UnitDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def change_unit_status(
    unit_id: uuid.UUID,
    body: UnitStatusChange,
    db: AsyncSession = Depends(get_db_session),
) -> UnitDetailOut:
    company_id = await get_company_id(db)
    result = await change_status(db, company_id, unit_id, body.target_status)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_not_found")
    if result == "invalid_transition":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid_status_transition",
        )
    return UnitDetailOut(data=UnitOut.model_validate(result))


@router.delete(
    "/{unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def delete_unit_endpoint(
    unit_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await delete_unit(db, company_id, unit_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_not_found")
