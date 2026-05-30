"""Service — Buildings + Floors + occupancy."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.building import Building
from app.models.floor import Floor
from app.models.unit import Unit
from app.routers.buildings.schemas import (
    BuildingCreate,
    BuildingUpdate,
    FloorCreate,
    OccupancySummary,
)

# ─── Helpers métier purs ──────────────────────────────────────────────────


def compute_occupancy(by_status: dict[str, int]) -> tuple[Decimal, Decimal]:
    """
    À partir du compte d'unités par statut, calcule (occupancy_pct, vacancy_pct).
    - Occupé = 'occupied' + 'reserved'
    - Vacant = 'vacant'
    - Hors marché = 'maintenance' + 'renovation' + 'off_market' (exclus du dénominateur)
    """
    occupied = by_status.get("occupied", 0) + by_status.get("reserved", 0)
    vacant = by_status.get("vacant", 0)
    eligible = occupied + vacant
    if eligible == 0:
        return Decimal("0.00"), Decimal("0.00")
    occ = (Decimal(occupied) * 100 / eligible).quantize(Decimal("0.01"))
    vac = (Decimal(vacant) * 100 / eligible).quantize(Decimal("0.01"))
    return occ, vac


# ─── Buildings CRUD ───────────────────────────────────────────────────────


def _location_wkt(location: dict | None) -> str | None:
    """Sérialise un GeoPoint en WKT pour PostGIS."""
    if location is None:
        return None
    return f"SRID=4326;POINT({location['lng']} {location['lat']})"


async def list_buildings(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    emirate: str | None = None,
    building_type: str | None = None,
    status: str | None = None,
) -> tuple[list[Building], int]:
    base = select(Building).where(
        Building.company_id == company_id,
        Building.deleted_at.is_(None),
    )
    if emirate:
        base = base.where(Building.emirate == emirate)
    if building_type:
        base = base.where(Building.building_type == building_type)
    if status:
        base = base.where(Building.status == status)

    total: int = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    offset = (page - 1) * limit
    paginated = base.order_by(Building.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_building(
    db: AsyncSession, company_id: uuid.UUID, building_id: uuid.UUID
) -> Building | None:
    result = await db.execute(
        select(Building).where(
            Building.id == building_id,
            Building.company_id == company_id,
            Building.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_building(
    db: AsyncSession, company_id: uuid.UUID, data: BuildingCreate
) -> Building:
    building = Building(
        company_id=company_id,
        reference=data.reference,
        owner_party_id=data.owner_party_id,
        name_ar=data.name_ar,
        name_en=data.name_en,
        name_fr=data.name_fr,
        building_type=data.building_type,
        location=_location_wkt(data.location.model_dump() if data.location else None),
        address_en=data.address_en,
        address_ar=data.address_ar,
        district=data.district,
        emirate=data.emirate,
        total_floors=data.total_floors,
        total_units=data.total_units,
        year_built=data.year_built,
        developer=data.developer,
        dld_property_number=data.dld_property_number,
        dld_tenure=data.dld_tenure,
        insurance_policy_number=data.insurance_policy_number,
        insurance_expiry=data.insurance_expiry,
        amenities=data.amenities,
        estimated_value_aed=data.estimated_value_aed,
        notes=data.notes,
    )
    db.add(building)
    await db.commit()
    await db.refresh(building)
    return building


async def update_building(
    db: AsyncSession,
    company_id: uuid.UUID,
    building_id: uuid.UUID,
    data: BuildingUpdate,
) -> Building | None:
    building = await get_building(db, company_id, building_id)
    if building is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "location" in update_data and update_data["location"] is not None:
        update_data["location"] = _location_wkt(update_data["location"])

    for field, value in update_data.items():
        setattr(building, field, value)
    building.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(building)
    return building


async def delete_building(db: AsyncSession, company_id: uuid.UUID, building_id: uuid.UUID) -> bool:
    building = await get_building(db, company_id, building_id)
    if building is None:
        return False
    building.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


# ─── Floors ───────────────────────────────────────────────────────────────


async def list_floors(
    db: AsyncSession, company_id: uuid.UUID, building_id: uuid.UUID
) -> list[Floor]:
    result = await db.execute(
        select(Floor)
        .where(
            Floor.building_id == building_id,
            Floor.company_id == company_id,
        )
        .order_by(Floor.floor_number)
    )
    return list(result.scalars().all())


async def create_floor(db: AsyncSession, company_id: uuid.UUID, data: FloorCreate) -> Floor | None:
    # Building must exist in same tenant
    building = await get_building(db, company_id, data.building_id)
    if building is None:
        return None

    floor = Floor(
        company_id=company_id,
        building_id=data.building_id,
        floor_number=data.floor_number,
        label=data.label,
        planned_units=data.planned_units,
    )
    db.add(floor)
    await db.commit()
    await db.refresh(floor)
    return floor


# ─── Occupancy ────────────────────────────────────────────────────────────


async def occupancy_summary(
    db: AsyncSession, company_id: uuid.UUID, building_id: uuid.UUID
) -> OccupancySummary | None:
    building = await get_building(db, company_id, building_id)
    if building is None:
        return None

    rows = (
        await db.execute(
            select(Unit.status, func.count(Unit.id))
            .where(
                Unit.building_id == building_id,
                Unit.company_id == company_id,
                Unit.deleted_at.is_(None),
            )
            .group_by(Unit.status)
        )
    ).all()

    by_status = {status: count for status, count in rows}
    total = sum(by_status.values())
    occ, vac = compute_occupancy(by_status)

    return OccupancySummary(
        building_id=building_id,
        total_units=total,
        by_status=by_status,
        occupancy_rate_pct=occ,
        vacancy_rate_pct=vac,
    )
