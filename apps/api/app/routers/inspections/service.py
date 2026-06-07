"""Service Inspections — CRUD + machine à états + helpers purs."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.references import commit_with_reference_retry
from app.models.inspection import (
    Inspection,
    InspectionItem,
    InspectionPhoto,
    InspectionSection,
)

from .schemas import (
    InspectionCreate,
    InspectionUpdate,
    ItemCreate,
    ItemUpdate,
    SectionCreate,
)

# ── Machine à états ───────────────────────────────────────────────────────

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["scheduled", "in_progress", "cancelled"],
    "scheduled": ["in_progress", "cancelled"],
    "in_progress": ["completed", "cancelled"],
    "completed": ["signed", "in_progress"],  # réouverture possible
    "signed": [],  # terminal
    "cancelled": [],  # terminal
}


def is_valid_transition(current: str, target: str) -> bool:
    return target in VALID_TRANSITIONS.get(current, [])


# ── Référence lisible ─────────────────────────────────────────────────────


def generate_reference(year: int, sequence: int) -> str:
    return f"INS-{year}-{sequence:06d}"


async def _next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    year = datetime.now(UTC).year
    count = (
        await db.execute(
            select(func.count(Inspection.id)).where(
                Inspection.company_id == company_id,
                func.extract("year", Inspection.created_at) == year,
            )
        )
    ).scalar_one() or 0
    return generate_reference(year, count + 1)


# ── Score global ─────────────────────────────────────────────────────────


def compute_overall_score(scores: list[int]) -> float | None:
    valid = [s for s in scores if s is not None]
    if not valid:
        return None
    return round(sum(valid) / len(valid), 2)


# ── Planning : inspections à venir / en retard ────────────────────────────

# Statuts « à planifier/réaliser » : on suit ceux qui attendent une action.
PLANNING_STATUSES: frozenset[str] = frozenset({"scheduled", "in_progress"})


def inspection_due_state(today: date, scheduled_date: date | None, status: str) -> str | None:
    """État d'échéance d'une inspection active, ou ``None``.

    - ``"overdue"`` : date planifiée dépassée ;
    - ``"today"`` : planifiée aujourd'hui ;
    - ``"upcoming"`` : planifiée plus tard ;
    - ``None`` : statut non actif (draft/completed/signed/cancelled) ou sans date.
    """
    if status not in PLANNING_STATUSES or scheduled_date is None:
        return None
    days = (scheduled_date - today).days
    if days < 0:
        return "overdue"
    if days == 0:
        return "today"
    return "upcoming"


# ── CRUD Inspections ──────────────────────────────────────────────────────


async def list_inspections(
    db: AsyncSession,
    company_id: uuid.UUID,
    unit_id: uuid.UUID | None = None,
    inspection_type: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Inspection], int]:
    filters = [
        Inspection.company_id == company_id,
        Inspection.deleted_at.is_(None),
    ]
    if unit_id:
        filters.append(Inspection.unit_id == unit_id)
    if inspection_type:
        filters.append(Inspection.inspection_type == inspection_type)
    if status:
        filters.append(Inspection.status == status)

    total = (
        await db.execute(select(func.count()).select_from(Inspection).where(and_(*filters)))
    ).scalar_one()

    result = await db.execute(
        select(Inspection)
        .where(and_(*filters))
        .order_by(Inspection.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def upcoming_inspections(
    db: AsyncSession, company_id: uuid.UUID, today: date, days: int = 30
) -> list[dict[str, Any]]:
    """Planning des inspections actives (scheduled/in_progress) avec date
    planifiée ≤ today+days (les retards passés sont inclus). Triées par date.
    Scopé ``company_id`` (Loi 1)."""
    horizon = today + timedelta(days=days)
    result = await db.execute(
        select(Inspection)
        .where(
            Inspection.company_id == company_id,
            Inspection.deleted_at.is_(None),
            Inspection.status.in_(tuple(PLANNING_STATUSES)),
            Inspection.scheduled_date.isnot(None),
            Inspection.scheduled_date <= horizon,
        )
        .order_by(Inspection.scheduled_date)
    )
    rows = list(result.scalars().all())
    return [
        {
            "id": i.id,
            "reference": i.reference,
            "inspection_type": i.inspection_type,
            "status": i.status,
            "scheduled_date": i.scheduled_date,
            "days_until": (i.scheduled_date - today).days if i.scheduled_date else None,
            "due_state": inspection_due_state(today, i.scheduled_date, i.status),
        }
        for i in rows
    ]


async def get_inspection(
    db: AsyncSession, company_id: uuid.UUID, inspection_id: uuid.UUID
) -> Inspection | None:
    result = await db.execute(
        select(Inspection).where(
            Inspection.id == inspection_id,
            Inspection.company_id == company_id,
            Inspection.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_inspection(
    db: AsyncSession, company_id: uuid.UUID, data: InspectionCreate
) -> Inspection:
    return await commit_with_reference_retry(
        db,
        lambda: _next_reference(db, company_id),
        lambda ref: Inspection(
            company_id=company_id,
            reference=ref,
            unit_id=data.unit_id,
            rental_id=data.rental_id,
            contract_id=data.contract_id,
            inspection_type=data.inspection_type,
            status="draft",
            scheduled_date=data.scheduled_date,
            inspector_user_id=data.inspector_user_id,
            tenant_user_id=data.tenant_user_id,
            owner_user_id=data.owner_user_id,
            notes=data.notes,
        ),
    )


async def update_inspection(
    db: AsyncSession,
    company_id: uuid.UUID,
    inspection_id: uuid.UUID,
    data: InspectionUpdate,
) -> Inspection | None:
    insp = await get_inspection(db, company_id, inspection_id)
    if not insp:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(insp, field, value)
    await db.commit()
    await db.refresh(insp)
    return insp


async def transition_inspection(
    db: AsyncSession,
    company_id: uuid.UUID,
    inspection_id: uuid.UUID,
    target: str,
    signed_by: str | None = None,
) -> Inspection | None:
    insp = await get_inspection(db, company_id, inspection_id)
    if not insp:
        return None
    if not is_valid_transition(insp.status, target):
        raise HTTPException(
            status_code=422,
            detail=f"invalid_transition: '{insp.status}'→'{target}' "
            f"(autorisées: {VALID_TRANSITIONS.get(insp.status, [])})",
        )
    now = datetime.now(UTC)
    insp.status = target
    if target == "completed":
        insp.completed_at = now
        # Calcule le score global à partir des items.
        scores = await _collect_scores(db, company_id, inspection_id)
        insp.overall_score = compute_overall_score(scores)
    elif target == "signed":
        insp.signed_by = signed_by
        insp.signed_at = now
    await db.commit()
    await db.refresh(insp)
    return insp


async def _collect_scores(
    db: AsyncSession, company_id: uuid.UUID, inspection_id: uuid.UUID
) -> list[int]:
    result = await db.execute(
        select(InspectionItem.score)
        .join(InspectionSection, InspectionItem.section_id == InspectionSection.id)
        .where(
            InspectionSection.inspection_id == inspection_id,
            InspectionSection.company_id == company_id,
            InspectionItem.score.isnot(None),
        )
    )
    return [row[0] for row in result.all()]


async def soft_delete_inspection(
    db: AsyncSession, company_id: uuid.UUID, inspection_id: uuid.UUID
) -> bool:
    insp = await get_inspection(db, company_id, inspection_id)
    if not insp:
        return False
    insp.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


# ── Sections ──────────────────────────────────────────────────────────────


async def list_sections(
    db: AsyncSession, company_id: uuid.UUID, inspection_id: uuid.UUID
) -> list[InspectionSection]:
    result = await db.execute(
        select(InspectionSection)
        .where(
            InspectionSection.inspection_id == inspection_id,
            InspectionSection.company_id == company_id,
        )
        .order_by(InspectionSection.section_order)
    )
    return list(result.scalars().all())


async def create_section(
    db: AsyncSession,
    company_id: uuid.UUID,
    inspection_id: uuid.UUID,
    data: SectionCreate,
) -> InspectionSection:
    sec = InspectionSection(
        company_id=company_id,
        inspection_id=inspection_id,
        name=data.name,
        section_order=data.section_order,
        notes=data.notes,
    )
    db.add(sec)
    await db.commit()
    await db.refresh(sec)
    return sec


# ── Items ─────────────────────────────────────────────────────────────────


async def list_items(
    db: AsyncSession, company_id: uuid.UUID, section_id: uuid.UUID
) -> list[InspectionItem]:
    result = await db.execute(
        select(InspectionItem)
        .where(
            InspectionItem.section_id == section_id,
            InspectionItem.company_id == company_id,
        )
        .order_by(InspectionItem.item_order)
    )
    return list(result.scalars().all())


async def create_item(
    db: AsyncSession,
    company_id: uuid.UUID,
    section_id: uuid.UUID,
    data: ItemCreate,
) -> InspectionItem:
    item = InspectionItem(
        company_id=company_id,
        section_id=section_id,
        name=data.name,
        item_order=data.item_order,
        condition=data.condition,
        score=data.score,
        comment=data.comment,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_item(
    db: AsyncSession,
    company_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemUpdate,
) -> InspectionItem | None:
    result = await db.execute(
        select(InspectionItem).where(
            InspectionItem.id == item_id,
            InspectionItem.company_id == company_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


# ── Photos ────────────────────────────────────────────────────────────────


async def add_photo(
    db: AsyncSession,
    company_id: uuid.UUID,
    item_id: uuid.UUID,
    file_key: str,
    caption: str | None,
) -> InspectionPhoto:
    photo = InspectionPhoto(
        company_id=company_id,
        item_id=item_id,
        file_key=file_key,
        caption=caption,
        uploaded_at=datetime.now(UTC),
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return photo


async def list_photos(
    db: AsyncSession, company_id: uuid.UUID, item_id: uuid.UUID
) -> list[InspectionPhoto]:
    result = await db.execute(
        select(InspectionPhoto)
        .where(
            InspectionPhoto.item_id == item_id,
            InspectionPhoto.company_id == company_id,
        )
        .order_by(InspectionPhoto.uploaded_at)
    )
    return list(result.scalars().all())
