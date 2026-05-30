"""Router FastAPI — Buildings (+ floors imbriqués)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.buildings.schemas import (
    BuildingCreate,
    BuildingDetailOut,
    BuildingListOut,
    BuildingOut,
    BuildingUpdate,
    FloorCreate,
    FloorListOut,
    FloorOut,
    OccupancySummaryOut,
)
from app.routers.buildings.service import (
    create_building,
    create_floor,
    delete_building,
    get_building,
    list_buildings,
    list_floors,
    occupancy_summary,
    update_building,
)
from app.routers.units.schemas import UnitListOut, UnitOut
from app.routers.units.service import list_units

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "buildings", "status": "ok"}


@router.get("/", response_model=BuildingListOut)
async def list_buildings_endpoint(
    emirate: str | None = Query(None, pattern="^(DXB|AUH|SHJ|AJM|RAK|FUJ|UAQ)$"),
    building_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BuildingListOut:
    company_id = await get_company_id(db)
    buildings, total = await list_buildings(
        db, company_id, page, limit, emirate, building_type, status_filter
    )
    return BuildingListOut(
        data=[BuildingOut.model_validate(b) for b in buildings],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=BuildingDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def create_building_endpoint(
    body: BuildingCreate,
    db: AsyncSession = Depends(get_db_session),
) -> BuildingDetailOut:
    company_id = await get_company_id(db)
    building = await create_building(db, company_id, body)
    return BuildingDetailOut(data=BuildingOut.model_validate(building))


@router.get("/{building_id}", response_model=BuildingDetailOut)
async def get_building_endpoint(
    building_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> BuildingDetailOut:
    company_id = await get_company_id(db)
    building = await get_building(db, company_id, building_id)
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="building_not_found")
    return BuildingDetailOut(data=BuildingOut.model_validate(building))


@router.patch(
    "/{building_id}",
    response_model=BuildingDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def update_building_endpoint(
    building_id: uuid.UUID,
    body: BuildingUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> BuildingDetailOut:
    company_id = await get_company_id(db)
    building = await update_building(db, company_id, building_id, body)
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="building_not_found")
    return BuildingDetailOut(data=BuildingOut.model_validate(building))


@router.delete(
    "/{building_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
async def delete_building_endpoint(
    building_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await delete_building(db, company_id, building_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="building_not_found")


@router.get("/{building_id}/occupancy", response_model=OccupancySummaryOut)
async def occupancy_endpoint(
    building_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> OccupancySummaryOut:
    company_id = await get_company_id(db)
    summary = await occupancy_summary(db, company_id, building_id)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="building_not_found")
    return OccupancySummaryOut(data=summary)


# ─── Floors imbriqués ─────────────────────────────────────────────────────


@router.get("/{building_id}/floors", response_model=FloorListOut)
async def list_floors_endpoint(
    building_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> FloorListOut:
    company_id = await get_company_id(db)
    floors = await list_floors(db, company_id, building_id)
    return FloorListOut(
        data=[FloorOut.model_validate(f) for f in floors],
        meta={"total": len(floors)},
    )


@router.get("/{building_id}/units", response_model=UnitListOut)
async def list_building_units_endpoint(
    building_id: uuid.UUID,
    floor_id: uuid.UUID | None = Query(None),
    unit_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> UnitListOut:
    """Liste imbriquée des unités d'un bâtiment (confort hiérarchique)."""
    company_id = await get_company_id(db)
    building = await get_building(db, company_id, building_id)
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="building_not_found")
    units, total = await list_units(
        db, company_id, page, limit, building_id, floor_id, unit_type, status_filter
    )
    return UnitListOut(
        data=[UnitOut.model_validate(u) for u in units],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/{building_id}/floors",
    response_model=FloorOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def create_floor_endpoint(
    building_id: uuid.UUID,
    body: FloorCreate,
    db: AsyncSession = Depends(get_db_session),
) -> FloorOut:
    if body.building_id != building_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="building_id_mismatch",
        )
    company_id = await get_company_id(db)
    floor = await create_floor(db, company_id, body)
    if floor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="building_not_found")
    return FloorOut.model_validate(floor)
