import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.golden_visa import schemas, service

router = APIRouter(prefix="/golden-visa", tags=["golden_visa"])


@router.get("/", response_model=schemas.GoldenVisaListOut)
async def list_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    client_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
):
    result = await service.list_applications(
        db, page=page, limit=limit, status=status, client_id=client_id
    )
    return {"success": True, **result}


@router.get("/expiring", response_model=schemas.GoldenVisaListOut)
async def expiring_visas(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
):
    apps = await service.get_expiring_visas(db, days=days)
    return {
        "success": True,
        "data": apps,
        "meta": {"total": len(apps), "page": 1, "limit": len(apps) or 1, "pages": 1},
    }


@router.post("/", response_model=schemas.GoldenVisaDetailOut, status_code=201)
async def create_application(
    payload: schemas.GoldenVisaCreate,
    db: AsyncSession = Depends(get_db_session),
):
    app = await service.create_application(db, payload)
    return {"success": True, "data": app}


@router.get("/{app_id}", response_model=schemas.GoldenVisaDetailOut)
async def get_application(app_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    app = await service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
    return {"success": True, "data": app}


@router.patch("/{app_id}", response_model=schemas.GoldenVisaDetailOut)
async def update_application(
    app_id: uuid.UUID,
    payload: schemas.GoldenVisaUpdate,
    db: AsyncSession = Depends(get_db_session),
):
    app = await service.update_application(db, app_id, payload)
    if not app:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
    return {"success": True, "data": app}


@router.delete("/{app_id}", status_code=204)
async def delete_application(app_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    deleted = await service.delete_application(db, app_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
