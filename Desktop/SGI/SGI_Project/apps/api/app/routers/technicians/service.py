"""Service — Technicians. Profil rattaché à un User salarié."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.party_technician import Technician
from app.models.user import User
from app.routers.technicians.schemas import TechnicianCreate, TechnicianUpdate
from app.routers.vendors.service import merge_rating  # même formule cumulée


def summarize_technicians(technicians: list[Any]) -> dict[str, Any]:
    """Synthèse de capacité de dispatch : nombre de techniciens connectés (mobile)
    et d'astreinte, capacité par compétence, total des interventions. Helper pur."""
    by_skill: dict[str, int] = {}
    mobile_active_count = 0
    on_call_count = 0
    jobs_completed_total = 0
    for t in technicians:
        for skill in t.skills or []:
            by_skill[skill] = by_skill.get(skill, 0) + 1
        if t.mobile_active:
            mobile_active_count += 1
        if t.on_call:
            on_call_count += 1
        jobs_completed_total += t.jobs_completed
    return {
        "total": len(technicians),
        "mobile_active_count": mobile_active_count,
        "on_call_count": on_call_count,
        "by_skill": by_skill,
        "jobs_completed_total": jobs_completed_total,
    }


async def technicians_summary(db: AsyncSession, company_id: uuid.UUID) -> dict[str, Any]:
    """Synthèse de l'équipe technique du tenant (Loi 1 : scopé company_id)."""
    result = await db.execute(
        select(Technician).where(
            Technician.company_id == company_id, Technician.deleted_at.is_(None)
        )
    )
    return summarize_technicians(list(result.scalars().all()))


# ─── CRUD ─────────────────────────────────────────────────────────────────


async def list_technicians(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    mobile_active: bool | None = None,
    on_call: bool | None = None,
) -> tuple[list[Technician], int]:
    base_query = select(Technician).where(
        Technician.company_id == company_id,
        Technician.deleted_at.is_(None),
    )
    if mobile_active is not None:
        base_query = base_query.where(Technician.mobile_active == mobile_active)
    if on_call is not None:
        base_query = base_query.where(Technician.on_call == on_call)

    total: int = (
        await db.execute(select(func.count()).select_from(base_query.subquery()))
    ).scalar_one()

    offset = (page - 1) * limit
    paginated = base_query.order_by(Technician.rating_avg.desc()).offset(offset).limit(limit)
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_technician(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> Technician | None:
    result = await db.execute(
        select(Technician).where(
            Technician.user_id == user_id,
            Technician.company_id == company_id,
            Technician.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_technician(
    db: AsyncSession, company_id: uuid.UUID, data: TechnicianCreate
) -> Technician | None:
    # User doit exister dans le même tenant
    user_check = await db.execute(
        select(User.id).where(
            User.id == data.user_id,
            User.company_id == company_id,
            User.deleted_at.is_(None),
        )
    )
    if user_check.scalar_one_or_none() is None:
        return None

    if await get_technician(db, company_id, data.user_id) is not None:
        return None

    tech = Technician(
        user_id=data.user_id,
        company_id=company_id,
        skills=data.skills,
        assigned_zones=data.assigned_zones,
        mobile_active=data.mobile_active,
        on_call=data.on_call,
        emergency_contact_phone=data.emergency_contact_phone,
    )
    db.add(tech)
    await db.commit()
    await db.refresh(tech)
    return tech


async def update_technician(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    data: TechnicianUpdate,
) -> Technician | None:
    tech = await get_technician(db, company_id, user_id)
    if tech is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tech, field, value)
    tech.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(tech)
    return tech


async def add_rating(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    score: Decimal,
) -> Technician | None:
    tech = await get_technician(db, company_id, user_id)
    if tech is None:
        return None
    new_avg, new_count = merge_rating(tech.rating_avg, tech.rating_count, score)
    tech.rating_avg = new_avg
    tech.rating_count = new_count
    tech.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(tech)
    return tech


async def delete_technician(db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    tech = await get_technician(db, company_id, user_id)
    if tech is None:
        return False
    tech.deleted_at = datetime.now(UTC)
    await db.commit()
    return True
