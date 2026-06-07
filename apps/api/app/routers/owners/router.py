"""Router FastAPI — Owners (profil propriétaire)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.iam.assurance_deps import assert_assurance
from app.routers.owners.schemas import (
    MandateExpiryOut,
    OwnerCreate,
    OwnerDetailOut,
    OwnerListOut,
    OwnerOut,
    OwnerUpdate,
)
from app.routers.owners.service import (
    create_owner,
    delete_owner,
    expiring_mandates,
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


@router.get("/mandates-expiring", response_model=MandateExpiryOut)
async def mandates_expiring_endpoint(
    days: int = Query(90, ge=1, le=730),
    db: AsyncSession = Depends(get_db_session),
) -> MandateExpiryOut:
    """Mandats de gestion arrivant à échéance (ou en retard) dans `days` jours —
    à renouveler (obligation légale UAE). Triés par date d'échéance."""
    from datetime import UTC, datetime

    company_id = await get_company_id(db)
    today = datetime.now(UTC).date()
    entries = await expiring_mandates(db, company_id, today, days)
    return MandateExpiryOut(data=entries, meta={"reference_date": str(today), "horizon_days": days})


@router.get("/{party_id}", response_model=OwnerDetailOut)
async def get_owner_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> OwnerDetailOut:
    company_id = await get_company_id(db)
    owner = await get_owner(db, company_id, party_id)
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="owner_not_found")
    return OwnerDetailOut(data=OwnerOut.model_validate(owner))


@router.patch(
    "/{party_id}",
    response_model=OwnerDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def update_owner_endpoint(
    party_id: uuid.UUID,
    body: OwnerUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> OwnerDetailOut:
    company_id = await get_company_id(db)
    # Enforcement assurance « UAE PASS Infinity » : la modification de l'IBAN du
    # propriétaire est une action sensible (détournement de virement) → niveau L3
    # requis. On ne garde QUE lorsque le champ `bank_iban` est réellement fourni,
    # pour ne pas sur-restreindre une simple mise à jour de nom/téléphone.
    if "bank_iban" in body.model_fields_set:
        raw_uid = getattr(request.state, "user_id", None)
        if not raw_uid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthenticated")
        await assert_assurance(db, company_id, uuid.UUID(raw_uid), "change_owner_iban")
    owner = await update_owner(db, company_id, party_id, body)
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="owner_not_found")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="owner_not_found")
