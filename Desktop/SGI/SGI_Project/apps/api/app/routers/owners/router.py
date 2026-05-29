"""Router FastAPI — Owners (profil propriétaire)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.owners.schemas import (
    OwnerCreate,
    OwnerDetailOut,
    OwnerListOut,
    OwnerOut,
    OwnerUpdate,
)
from app.routers.owners.service import (
    create_owner,
    delete_owner,
    get_owner,
    list_owners,
    update_owner,
)

router = APIRouter(prefix="/owners", tags=["owners"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "owners", "status": "ok"}


@router.get("/", response_model=OwnerListOut)
async def list_owners_endpoint(
    residency_uae: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> OwnerListOut:
    company_id = await get_company_id(db)
    owners, total = await list_owners(db, company_id, page, limit, residency_uae)
    return OwnerListOut(
        data=[OwnerOut.model_validate(o) for o in owners],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=OwnerDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def create_owner_endpoint(
    body: OwnerCreate,
    db: AsyncSession = Depends(get_db_session),
) -> OwnerDetailOut:
    company_id = await get_company_id(db)
    owner = await create_owner(db, company_id, body)
    if owner is None:
        # Soit le client n'existe pas, soit un profil owner existe déjà
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="party_not_found_or_owner_exists",
        )
    return OwnerDetailOut(data=OwnerOut.model_validate(owner))


@router.get("/{party_id}", response_model=OwnerDetailOut)
async def get_owner_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> OwnerDetailOut:
    company_id = await get_company_id(db)
    owner = await get_owner(db, company_id, party_id)
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="owner_not_found"
        )
    return OwnerDetailOut(data=OwnerOut.model_validate(owner))


@router.patch(
    "/{party_id}",
    response_model=OwnerDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def update_owner_endpoint(
    party_id: uuid.UUID,
    body: OwnerUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> OwnerDetailOut:
    company_id = await get_company_id(db)
    owner = await update_owner(db, company_id, party_id, body)
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="owner_not_found"
        )
    return OwnerDetailOut(data=OwnerOut.model_validate(owner))


@router.delete(
    "/{party_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def delete_owner_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await delete_owner(db, company_id, party_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="owner_not_found"
        )
