"""Router FastAPI — Technicians (techniciens internes)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.technicians.schemas import (
    TechnicianCreate,
    TechnicianDetailOut,
    TechnicianListOut,
    TechnicianOut,
    TechnicianRatingInput,
    TechnicianUpdate,
)
from app.routers.technicians.service import (
    add_rating,
    create_technician,
    delete_technician,
    get_technician,
    list_technicians,
    update_technician,
)

router = APIRouter(prefix="/technicians", tags=["technicians"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "technicians", "status": "ok"}


@router.get("/", response_model=TechnicianListOut)
async def list_technicians_endpoint(
    mobile_active: bool | None = Query(None),
    on_call: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianListOut:
    company_id = await get_company_id(db)
    techs, total = await list_technicians(
        db, company_id, page, limit, mobile_active, on_call
    )
    return TechnicianListOut(
        data=[TechnicianOut.model_validate(t) for t in techs],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=TechnicianDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def create_technician_endpoint(
    body: TechnicianCreate,
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianDetailOut:
    company_id = await get_company_id(db)
    tech = await create_technician(db, company_id, body)
    if tech is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="user_not_found_or_technician_exists",
        )
    return TechnicianDetailOut(data=TechnicianOut.model_validate(tech))


@router.get("/{user_id}", response_model=TechnicianDetailOut)
async def get_technician_endpoint(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianDetailOut:
    company_id = await get_company_id(db)
    tech = await get_technician(db, company_id, user_id)
    if tech is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="technician_not_found"
        )
    return TechnicianDetailOut(data=TechnicianOut.model_validate(tech))


@router.patch(
    "/{user_id}",
    response_model=TechnicianDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def update_technician_endpoint(
    user_id: uuid.UUID,
    body: TechnicianUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianDetailOut:
    company_id = await get_company_id(db)
    tech = await update_technician(db, company_id, user_id, body)
    if tech is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="technician_not_found"
        )
    return TechnicianDetailOut(data=TechnicianOut.model_validate(tech))


@router.post(
    "/{user_id}/ratings",
    response_model=TechnicianDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def rate_technician_endpoint(
    user_id: uuid.UUID,
    body: TechnicianRatingInput,
    db: AsyncSession = Depends(get_db_session),
) -> TechnicianDetailOut:
    company_id = await get_company_id(db)
    tech = await add_rating(db, company_id, user_id, body.score)
    if tech is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="technician_not_found"
        )
    return TechnicianDetailOut(data=TechnicianOut.model_validate(tech))


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def delete_technician_endpoint(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await delete_technician(db, company_id, user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="technician_not_found"
        )
