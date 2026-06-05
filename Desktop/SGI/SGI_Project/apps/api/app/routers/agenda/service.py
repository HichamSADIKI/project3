import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agenda import AgendaEvent
from app.routers.agenda.schemas import AgendaEventCreate, AgendaEventUpdate


async def list_events(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    page: int = 1,
    limit: int = 50,
    event_type: str | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> tuple[list[AgendaEvent], int]:
    """Liste paginée des événements du tenant (filtres type/statut/plage de dates)."""
    conditions = [AgendaEvent.company_id == company_id, AgendaEvent.deleted_at.is_(None)]
    if event_type:
        conditions.append(AgendaEvent.event_type == event_type)
    if status:
        conditions.append(AgendaEvent.status == status)
    if date_from:
        conditions.append(AgendaEvent.start_at >= date_from)
    if date_to:
        conditions.append(AgendaEvent.start_at <= date_to)

    base = select(AgendaEvent).where(*conditions)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    rows = (
        (
            await db.execute(
                base.order_by(AgendaEvent.start_at).offset((page - 1) * limit).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def create_event(
    db: AsyncSession, company_id: uuid.UUID, payload: AgendaEventCreate
) -> AgendaEvent:
    event = AgendaEvent(company_id=company_id, **payload.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_event(
    db: AsyncSession, company_id: uuid.UUID, event_id: uuid.UUID
) -> AgendaEvent | None:
    return (
        await db.execute(
            select(AgendaEvent).where(
                AgendaEvent.id == event_id,
                AgendaEvent.company_id == company_id,
                AgendaEvent.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


async def update_event(
    db: AsyncSession, company_id: uuid.UUID, event_id: uuid.UUID, payload: AgendaEventUpdate
) -> AgendaEvent | None:
    event = await get_event(db, company_id, event_id)
    if event is None:
        return None
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    await db.commit()
    await db.refresh(event)
    return event


async def delete_event(db: AsyncSession, company_id: uuid.UUID, event_id: uuid.UUID) -> bool:
    event = await get_event(db, company_id, event_id)
    if event is None:
        return False
    event.deleted_at = datetime.now(UTC)
    await db.commit()
    return True
