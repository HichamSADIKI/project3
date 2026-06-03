"""Router FastAPI — Developers / Promoteurs immobiliers.

Tout est filtré par `company_id` (Loi 1) via `get_company_id`. Lecture ouverte aux
rôles internes (admin/manager/agent) ; écriture admin/manager ; suppression admin.
Anti-BOLA : 404 — jamais 403 — quand l'entité n'appartient pas au tenant.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.developers.schemas import (
    DeveloperCreate,
    DeveloperDetailOut,
    DeveloperListOut,
    DeveloperOut,
    DeveloperUpdate,
)
from app.routers.developers.service import (
    create_developer,
    delete_developer,
    get_developer,
    list_developers,
    update_developer,
)

router = APIRouter(prefix="/developers", tags=["developers"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "developers", "status": "ok"}


@router.get("/", response_model=DeveloperListOut)
async def list_developers_endpoint(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> DeveloperListOut:
    company_id = await get_company_id(db)
    developers, total = await list_developers(db, company_id, page, limit, search)
    return DeveloperListOut(
        data=[DeveloperOut.model_validate(d) for d in developers],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=DeveloperDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def create_developer_endpoint(
    body: DeveloperCreate,
    db: AsyncSession = Depends(get_db_session),
) -> DeveloperDetailOut:
    company_id = await get_company_id(db)
    developer = await create_developer(db, company_id, body)
    return DeveloperDetailOut(data=DeveloperOut.model_validate(developer))


@router.get("/{developer_id}", response_model=DeveloperDetailOut)
async def get_developer_endpoint(
    developer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> DeveloperDetailOut:
    company_id = await get_company_id(db)
    developer = await get_developer(db, company_id, developer_id)
    if developer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="developer_not_found")
    return DeveloperDetailOut(data=DeveloperOut.model_validate(developer))


@router.patch(
    "/{developer_id}",
    response_model=DeveloperDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def update_developer_endpoint(
    developer_id: uuid.UUID,
    body: DeveloperUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> DeveloperDetailOut:
    company_id = await get_company_id(db)
    developer = await update_developer(db, company_id, developer_id, body)
    if developer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="developer_not_found")
    return DeveloperDetailOut(data=DeveloperOut.model_validate(developer))


@router.delete(
    "/{developer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
async def delete_developer_endpoint(
    developer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await delete_developer(db, company_id, developer_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="developer_not_found")
