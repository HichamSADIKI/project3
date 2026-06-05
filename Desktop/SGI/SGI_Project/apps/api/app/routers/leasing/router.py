"""Router FastAPI — Leasing / Location.

Annonces de location + candidatures locataires. Tout est filtré par `company_id`
(Loi 1), gardé par rôle (`admin`/`manager`/`agent`), et chaque FK fournie
(unit_id, listing_id, applicant_client_id, converted_rental_id) est validée
comme appartenant au tenant courant (anti cross-tenant). Anti-BOLA : 404 — jamais
403 — quand la cible n'appartient pas au tenant (ne révèle pas son existence).
"""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.client import Client
from app.models.rental import Rental
from app.models.unit import Unit
from app.routers.leasing import service
from app.routers.leasing.schemas import (
    ApplicationCreate,
    ApplicationItemOut,
    ApplicationListOut,
    ApplicationOut,
    ApplicationTransitionBody,
    LeasingPipelineOut,
    ListingCreate,
    ListingFlagsUpdate,
    ListingItemOut,
    ListingListOut,
    ListingOut,
    ListingTransitionBody,
)

router = APIRouter(prefix="/leasing", tags=["leasing"])

_WRITE_ROLES = ("admin", "manager", "agent")


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


def _require_roles(*allowed_roles: str) -> Callable[[Request], Awaitable[None]]:
    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions"
            )

    return _check


async def _assert_unit_in_company(
    db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID
) -> None:
    exists = (
        await db.execute(
            select(Unit.id).where(
                Unit.id == unit_id,
                Unit.company_id == company_id,
                Unit.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="unit_not_in_company")


async def _assert_client_in_company(
    db: AsyncSession, company_id: uuid.UUID, client_id: uuid.UUID
) -> None:
    exists = (
        await db.execute(
            select(Client.id).where(
                Client.id == client_id,
                Client.company_id == company_id,
                Client.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="client_not_in_company")


async def _assert_rental_in_company(
    db: AsyncSession, company_id: uuid.UUID, rental_id: uuid.UUID
) -> None:
    exists = (
        await db.execute(
            select(Rental.id).where(
                Rental.id == rental_id,
                Rental.company_id == company_id,
                Rental.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="rental_not_in_company")


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "leasing", "status": "ok"}


@router.get(
    "/pipeline",
    response_model=LeasingPipelineOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def leasing_pipeline_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> LeasingPipelineOut:
    """Synthèse du pipeline locatif : annonces et candidatures par statut, avec le
    loyer mensuel des annonces actives et le nombre de candidatures converties."""
    company_id = _get_company_id(request)
    summary = await service.leasing_pipeline_summary(db, company_id)
    return LeasingPipelineOut(data=summary, meta={})


# ── Annonces de location ──────────────────────────────────────────────────────


@router.get(
    "/listings",
    response_model=ListingListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_listings_endpoint(
    request: Request,
    status_: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> ListingListOut:
    company_id = _get_company_id(request)
    listings, total = await service.list_listings(
        db, company_id, page=page, limit=limit, status=status_
    )
    return ListingListOut(
        data=[ListingOut.model_validate(item) for item in listings],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/listings",
    response_model=ListingItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def create_listing_endpoint(
    body: ListingCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ListingItemOut:
    company_id = _get_company_id(request)
    # Loi 1 : la FK unit_id (optionnelle) DOIT appartenir au tenant.
    if body.unit_id is not None:
        await _assert_unit_in_company(db, company_id, body.unit_id)
    listing = await service.create_listing(
        db,
        company_id,
        monthly_rent=body.monthly_rent,
        unit_id=body.unit_id,
        title_ar=body.title_ar,
        title_en=body.title_en,
        title_fr=body.title_fr,
        annual_rent=body.annual_rent,
        available_from=body.available_from,
    )
    return ListingItemOut(data=ListingOut.model_validate(listing))


@router.get(
    "/listings/{listing_id}",
    response_model=ListingItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_listing_endpoint(
    listing_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ListingItemOut:
    company_id = _get_company_id(request)
    listing = await service.get_listing(db, company_id, listing_id)
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    return ListingItemOut(data=ListingOut.model_validate(listing))


@router.patch(
    "/listings/{listing_id}",
    response_model=ListingItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def update_listing_flags_endpoint(
    listing_id: uuid.UUID,
    body: ListingFlagsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ListingItemOut:
    """Toggles vitrine (Featured / Urgent) — backoffice uniquement."""
    company_id = _get_company_id(request)
    listing = await service.set_listing_flags(
        db, company_id, listing_id, is_featured=body.is_featured, is_urgent=body.is_urgent
    )
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    return ListingItemOut(data=ListingOut.model_validate(listing))


@router.post(
    "/listings/{listing_id}/transition",
    response_model=ListingItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def transition_listing_endpoint(
    listing_id: uuid.UUID,
    body: ListingTransitionBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ListingItemOut:
    company_id = _get_company_id(request)
    # 404 anti-BOLA si l'annonce n'appartient pas au tenant.
    if await service.get_listing(db, company_id, listing_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    try:
        listing = await service.transition_listing(db, company_id, listing_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if listing is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    return ListingItemOut(data=ListingOut.model_validate(listing))


# ── Candidatures locataires ───────────────────────────────────────────────────


@router.get(
    "/applications",
    response_model=ApplicationListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_applications_endpoint(
    request: Request,
    listing_id: uuid.UUID | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> ApplicationListOut:
    company_id = _get_company_id(request)
    applications, total = await service.list_applications(
        db, company_id, page=page, limit=limit, listing_id=listing_id, status=status_
    )
    return ApplicationListOut(
        data=[ApplicationOut.model_validate(item) for item in applications],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/applications",
    response_model=ApplicationItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def create_application_endpoint(
    body: ApplicationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ApplicationItemOut:
    company_id = _get_company_id(request)
    # Loi 1 : l'annonce ET le client candidat DOIVENT appartenir au tenant.
    if await service.get_listing(db, company_id, body.listing_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="listing_not_in_company"
        )
    await _assert_client_in_company(db, company_id, body.applicant_client_id)
    application = await service.create_application(
        db,
        company_id,
        listing_id=body.listing_id,
        applicant_client_id=body.applicant_client_id,
        offered_rent=body.offered_rent,
        screening_notes=body.screening_notes,
    )
    return ApplicationItemOut(data=ApplicationOut.model_validate(application))


@router.get(
    "/applications/{application_id}",
    response_model=ApplicationItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_application_endpoint(
    application_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ApplicationItemOut:
    company_id = _get_company_id(request)
    application = await service.get_application(db, company_id, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="application_not_found")
    return ApplicationItemOut(data=ApplicationOut.model_validate(application))


@router.post(
    "/applications/{application_id}/transition",
    response_model=ApplicationItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def transition_application_endpoint(
    application_id: uuid.UUID,
    body: ApplicationTransitionBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ApplicationItemOut:
    company_id = _get_company_id(request)
    # 404 anti-BOLA si la candidature n'appartient pas au tenant.
    if await service.get_application(db, company_id, application_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="application_not_found")
    # Loi 1 : si un bail est rattaché à la conversion, il DOIT appartenir au tenant.
    if body.converted_rental_id is not None:
        await _assert_rental_in_company(db, company_id, body.converted_rental_id)
    try:
        application = await service.transition_application(
            db,
            company_id,
            application_id,
            body.status,
            converted_rental_id=body.converted_rental_id,
            start_date=body.start_date,
            end_date=body.end_date,
            deposit=body.deposit,
            payment_frequency=body.payment_frequency,
        )
    except ValueError as exc:
        code = str(exc)
        # Transition d'état interdite → 409 ; impossibilité de conversion
        # (annonce/unité sans bien lié, loyer/période invalides) → 422.
        http_status = (
            status.HTTP_409_CONFLICT
            if code.startswith("invalid_transition")
            else status.HTTP_422_UNPROCESSABLE_ENTITY
        )
        raise HTTPException(status_code=http_status, detail=code) from exc
    if application is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="application_not_found")
    return ApplicationItemOut(data=ApplicationOut.model_validate(application))
