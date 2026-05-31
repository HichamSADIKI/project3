"""Service — Units. CRUD + transitions de statut."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.building import Building
from app.models.floor import Floor
from app.models.unit import Unit
from app.routers.units.schemas import UnitCreate, UnitUpdate

# ─── Logique métier pure ──────────────────────────────────────────────────


# Transitions valides du statut commercial d'une unité.
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "vacant": {"reserved", "occupied", "maintenance", "renovation", "off_market"},
    "reserved": {"occupied", "vacant"},
    "occupied": {"vacant", "maintenance"},
    "maintenance": {"vacant", "renovation"},
    "renovation": {"vacant", "maintenance"},
    "off_market": {"vacant"},
}


def is_valid_status_transition(current: str, target: str) -> bool:
    return target in _VALID_TRANSITIONS.get(current, set())


# ─── CRUD ─────────────────────────────────────────────────────────────────


async def list_units(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    building_id: uuid.UUID | None = None,
    floor_id: uuid.UUID | None = None,
    unit_type: str | None = None,
    status: str | None = None,
) -> tuple[list[Unit], int]:
    base = select(Unit).where(Unit.company_id == company_id, Unit.deleted_at.is_(None))
    if building_id:
        base = base.where(Unit.building_id == building_id)
    if floor_id:
        base = base.where(Unit.floor_id == floor_id)
    if unit_type:
        base = base.where(Unit.unit_type == unit_type)
    if status:
        base = base.where(Unit.status == status)

    total: int = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    offset = (page - 1) * limit
    paginated = base.order_by(Unit.unit_number).offset(offset).limit(limit)
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_unit(db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID) -> Unit | None:
    result = await db.execute(
        select(Unit).where(
            Unit.id == unit_id,
            Unit.company_id == company_id,
            Unit.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_unit(db: AsyncSession, company_id: uuid.UUID, data: UnitCreate) -> Unit | None:
    # Building must exist in same tenant
    building_check = await db.execute(
        select(Building.id).where(
            Building.id == data.building_id,
            Building.company_id == company_id,
            Building.deleted_at.is_(None),
        )
    )
    if building_check.scalar_one_or_none() is None:
        return None

    # If floor_id specified, must belong to that building
    if data.floor_id is not None:
        floor_check = await db.execute(
            select(Floor.id).where(
                Floor.id == data.floor_id,
                Floor.building_id == data.building_id,
                Floor.company_id == company_id,
            )
        )
        if floor_check.scalar_one_or_none() is None:
            return None

    unit = Unit(
        company_id=company_id,
        building_id=data.building_id,
        floor_id=data.floor_id,
        unit_number=data.unit_number,
        unit_type=data.unit_type,
        status=data.status,
        area_sqm=data.area_sqm,
        bedrooms=data.bedrooms,
        bathrooms=data.bathrooms,
        parking_spaces=data.parking_spaces,
        furnished=data.furnished,
        list_rent_aed=data.list_rent_aed,
        list_sale_aed=data.list_sale_aed,
        legacy_property_id=data.legacy_property_id,
        ejari_number=data.ejari_number,
        dewa_account_number=data.dewa_account_number,
        addc_account_number=data.addc_account_number,
        inventory=data.inventory,
        notes=data.notes,
    )
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    return unit


async def update_unit(
    db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID, data: UnitUpdate
) -> Unit | None:
    unit = await get_unit(db, company_id, unit_id)
    if unit is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(unit, field, value)
    unit.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(unit)
    return unit


async def change_status(
    db: AsyncSession,
    company_id: uuid.UUID,
    unit_id: uuid.UUID,
    target: str,
) -> Unit | None | str:
    unit = await get_unit(db, company_id, unit_id)
    if unit is None:
        return None
    if not is_valid_status_transition(unit.status, target):
        return "invalid_transition"
    unit.status = target
    unit.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(unit)
    return unit


async def delete_unit(db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID) -> bool:
    unit = await get_unit(db, company_id, unit_id)
    if unit is None:
        return False
    unit.deleted_at = datetime.now(UTC)
    await db.commit()
    return True
