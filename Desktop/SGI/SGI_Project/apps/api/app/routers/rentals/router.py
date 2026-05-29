"""Router FastAPI — Rentals."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.rentals.schemas import (
    RentalCreate,
    RentalDetailOut,
    RentalListOut,
    RentalOut,
    RentalUpdate,
)
from app.routers.rentals.service import (
    create_rental,
    get_expiring_rentals,
    get_rental,
    list_rentals,
    update_rental,
)

router = APIRouter(prefix="/rentals", tags=["rentals"])


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    """Récupère le company_id depuis la session PostgreSQL (injecté par le middleware JWT)."""
    result = await db.execute(
        sql_text("SELECT current_setting('app.current_company_id', true)")
    )
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_context_missing",
        )
    return uuid.UUID(raw)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "rentals", "status": "ok"}


@router.get("/expiring", response_model=RentalListOut)
async def list_expiring_rentals(
    days: int = Query(120, ge=1, le=365, description="Horizon en jours"),
    db: AsyncSession = Depends(get_db_session),
) -> RentalListOut:
    """Retourne les baux actifs expirant dans `days` jours (alerte J-120 par défaut)."""
    company_id = await _get_company_id(db)
    rentals = await get_expiring_rentals(db, company_id, days)
    return RentalListOut(
        data=[RentalOut.model_validate(r) for r in rentals],
        meta={"total": len(rentals), "page": 1, "limit": len(rentals)},
    )


@router.get("/", response_model=RentalListOut)
async def list_rentals_endpoint(
    status_filter: str | None = Query(
        None,
        alias="status",
        pattern="^(active|expiring|expired|terminated)$",
    ),
    expiring_in_days: int | None = Query(None, ge=1, le=365),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> RentalListOut:
    company_id = await _get_company_id(db)
    rentals, total = await list_rentals(
        db, company_id, page, limit, status_filter, expiring_in_days
    )
    return RentalListOut(
        data=[RentalOut.model_validate(r) for r in rentals],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post("/", response_model=RentalDetailOut, status_code=status.HTTP_201_CREATED)
async def create_rental_endpoint(
    body: RentalCreate,
    db: AsyncSession = Depends(get_db_session),
) -> RentalDetailOut:
    company_id = await _get_company_id(db)
    rental = await create_rental(db, company_id, body)
    return RentalDetailOut(data=RentalOut.model_validate(rental))


@router.get("/{rental_id}", response_model=RentalDetailOut)
async def get_rental_endpoint(
    rental_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> RentalDetailOut:
    company_id = await _get_company_id(db)
    rental = await get_rental(db, company_id, rental_id)
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="rental_not_found"
        )
    return RentalDetailOut(data=RentalOut.model_validate(rental))


@router.patch("/{rental_id}", response_model=RentalDetailOut)
async def update_rental_endpoint(
    rental_id: uuid.UUID,
    body: RentalUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> RentalDetailOut:
    company_id = await _get_company_id(db)
    rental = await update_rental(db, company_id, rental_id, body)
    if not rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="rental_not_found"
        )
    return RentalDetailOut(data=RentalOut.model_validate(rental))
