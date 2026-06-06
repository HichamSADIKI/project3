"""Logique métier — Developers / Promoteurs.

- Helper pur (testable sans DB) : `generate_reference`.
- Fonctions DB : CRUD filtré `company_id` (Loi 1), référence sous verrou consultatif
  (anti-collision déterministe, cf. acquisitions/sales/leasing).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.developers.models import Developer
from app.routers.developers.schemas import DeveloperCreate, DeveloperUpdate


def generate_reference(year: int, sequence: int) -> str:
    """Référence triable : `DEV-2026-000042`."""
    return f"DEV-{year:04d}-{sequence:06d}"


async def next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    """Prochaine référence `DEV-YYYY-NNNNNN` pour le tenant (séquence par société
    et par année). Verrou consultatif transactionnel (libéré au COMMIT) pour
    sérialiser les créations concurrentes → pas de collision de référence."""
    year = datetime.now(UTC).year
    prefix = f"DEV-{year:04d}-%"
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
        {"k": f"DEV:{company_id}:{year}"},
    )
    count = (
        await db.execute(
            select(func.count())
            .select_from(Developer)
            .where(Developer.company_id == company_id, Developer.reference.like(prefix))
        )
    ).scalar_one()
    return generate_reference(year, count + 1)


async def list_developers(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
) -> tuple[list[Developer], int]:
    base = select(Developer).where(
        Developer.company_id == company_id,
        Developer.deleted_at.is_(None),
    )
    if search:
        base = base.where(Developer.name_en.ilike(f"%{search}%"))

    total: int = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    paginated = base.order_by(Developer.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_developer(
    db: AsyncSession, company_id: uuid.UUID, developer_id: uuid.UUID
) -> Developer | None:
    result = await db.execute(
        select(Developer).where(
            Developer.id == developer_id,
            Developer.company_id == company_id,
            Developer.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_developer(
    db: AsyncSession, company_id: uuid.UUID, data: DeveloperCreate
) -> Developer:
    developer = Developer(
        company_id=company_id,
        reference=await next_reference(db, company_id),
        name_en=data.name_en,
        name_ar=data.name_ar,
        name_fr=data.name_fr,
        city=data.city,
        country=data.country,
        trade_license=data.trade_license,
        phone=data.phone,
        email=data.email,
        website=data.website,
        projects_count=data.projects_count,
        units_count=data.units_count,
        notes=data.notes,
    )
    db.add(developer)
    await db.commit()
    await db.refresh(developer)
    return developer


async def update_developer(
    db: AsyncSession,
    company_id: uuid.UUID,
    developer_id: uuid.UUID,
    data: DeveloperUpdate,
) -> Developer | None:
    developer = await get_developer(db, company_id, developer_id)
    if developer is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(developer, field, value)
    developer.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(developer)
    return developer


async def delete_developer(
    db: AsyncSession, company_id: uuid.UUID, developer_id: uuid.UUID
) -> bool:
    developer = await get_developer(db, company_id, developer_id)
    if developer is None:
        return False
    developer.deleted_at = datetime.now(UTC)
    await db.commit()
    return True
