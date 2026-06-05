import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.agenda import schemas, service

router = APIRouter(prefix="/agenda", tags=["agenda"])

_ROLES = ("admin", "manager", "agent")


@router.get("", response_model=schemas.AgendaEventListOut)
async def list_events(
    event_type: str | None = Query(None),
    status: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles(*_ROLES)),
) -> schemas.AgendaEventListOut:
    cid = await get_company_id(db)
    rows, total = await service.list_events(
        db,
        cid,
        page=page,
        limit=limit,
        event_type=event_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    pages = (total + limit - 1) // limit
    return schemas.AgendaEventListOut(
        data=[schemas.AgendaEventOut.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit, "pages": pages},
    )


@router.post(
    "", response_model=schemas.AgendaEventDetailOut, status_code=http_status.HTTP_201_CREATED
)
async def create_event(
    body: schemas.AgendaEventCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles(*_ROLES)),
) -> schemas.AgendaEventDetailOut:
    cid = await get_company_id(db)
    event = await service.create_event(db, cid, body)
    return schemas.AgendaEventDetailOut(data=schemas.AgendaEventOut.model_validate(event))


@router.get("/{event_id}", response_model=schemas.AgendaEventDetailOut)
async def get_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles(*_ROLES)),
) -> schemas.AgendaEventDetailOut:
    cid = await get_company_id(db)
    event = await service.get_event(db, cid, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="agenda_event_not_found")
    return schemas.AgendaEventDetailOut(data=schemas.AgendaEventOut.model_validate(event))


@router.patch("/{event_id}", response_model=schemas.AgendaEventDetailOut)
async def update_event(
    event_id: uuid.UUID,
    body: schemas.AgendaEventUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles(*_ROLES)),
) -> schemas.AgendaEventDetailOut:
    cid = await get_company_id(db)
    event = await service.update_event(db, cid, event_id, body)
    if event is None:
        raise HTTPException(status_code=404, detail="agenda_event_not_found")
    return schemas.AgendaEventDetailOut(data=schemas.AgendaEventOut.model_validate(event))


@router.delete("/{event_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles(*_ROLES)),
) -> None:
    cid = await get_company_id(db)
    deleted = await service.delete_event(db, cid, event_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="agenda_event_not_found")
