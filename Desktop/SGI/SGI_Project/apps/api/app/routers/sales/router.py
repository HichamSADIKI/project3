"""Router FastAPI — module Vente (sales).

Pipeline pré-contrat : mandat → annonce → offre → transaction (+ commission).
Tout est filtré par `company_id` (Loi 1) ; chaque endpoint exige un rôle
write (admin/manager/agent). Anti-BOLA : 404 (jamais 403) si la cible est hors
tenant, pour ne pas révéler son existence. Chaque FK fournie est validée ∈ tenant.
"""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.client import Client
from app.models.property import Property
from app.routers.sales import service
from app.routers.sales.schemas import (
    ListingCreate,
    ListingFlagsUpdate,
    ListingItemOut,
    ListingListOut,
    ListingOut,
    ListingTransition,
    MandateCreate,
    MandateItemOut,
    MandateListOut,
    MandateOut,
    MandateTransition,
    OfferCreate,
    OfferItemOut,
    OfferListOut,
    OfferOut,
    OfferTransition,
    TransactionCreate,
    TransactionItemOut,
    TransactionListOut,
    TransactionOut,
    TransactionTransition,
)

router = APIRouter(prefix="/sales", tags=["sales"])

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


async def _assert_client_in_tenant(
    db: AsyncSession, company_id: uuid.UUID, client_id: uuid.UUID
) -> None:
    """Valide qu'un client appartient au tenant (Loi 1) — la FK contourne la RLS."""
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


async def _assert_property_in_tenant(
    db: AsyncSession, company_id: uuid.UUID, property_id: uuid.UUID
) -> None:
    exists = (
        await db.execute(
            select(Property.id).where(
                Property.id == property_id,
                Property.company_id == company_id,
                Property.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="property_not_in_company"
        )


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "sales", "status": "ok"}


# ── Mandats ──────────────────────────────────────────────────────────────────


@router.get(
    "/mandates",
    response_model=MandateListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_mandates_endpoint(
    request: Request,
    status_: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> MandateListOut:
    company_id = _get_company_id(request)
    rows, total = await service.list_mandates(
        db, company_id, page=page, limit=limit, status=status_
    )
    return MandateListOut(
        data=[MandateOut.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/mandates",
    response_model=MandateItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def create_mandate_endpoint(
    body: MandateCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MandateItemOut:
    company_id = _get_company_id(request)
    await _assert_client_in_tenant(db, company_id, body.seller_client_id)
    if body.property_id is not None:
        await _assert_property_in_tenant(db, company_id, body.property_id)
    mandate = await service.create_mandate(
        db,
        company_id,
        seller_client_id=body.seller_client_id,
        property_id=body.property_id,
        mandate_type=body.mandate_type,
        commission_rate=body.commission_rate,
        asking_price=body.asking_price,
    )
    return MandateItemOut(data=MandateOut.model_validate(mandate))


@router.get(
    "/mandates/{mandate_id}",
    response_model=MandateItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_mandate_endpoint(
    mandate_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MandateItemOut:
    company_id = _get_company_id(request)
    mandate = await service.get_mandate(db, company_id, mandate_id)
    if mandate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    return MandateItemOut(data=MandateOut.model_validate(mandate))


@router.post(
    "/mandates/{mandate_id}/transition",
    response_model=MandateItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def transition_mandate_endpoint(
    mandate_id: uuid.UUID,
    body: MandateTransition,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MandateItemOut:
    company_id = _get_company_id(request)
    if await service.get_mandate(db, company_id, mandate_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    try:
        mandate = await service.transition_mandate(db, company_id, mandate_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if mandate is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    return MandateItemOut(data=MandateOut.model_validate(mandate))


# ── Annonces ─────────────────────────────────────────────────────────────────


@router.get(
    "/listings",
    response_model=ListingListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_listings_endpoint(
    request: Request,
    status_: str | None = Query(None, alias="status"),
    mandate_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> ListingListOut:
    company_id = _get_company_id(request)
    rows, total = await service.list_listings(
        db, company_id, page=page, limit=limit, status=status_, mandate_id=mandate_id
    )
    return ListingListOut(
        data=[ListingOut.model_validate(r) for r in rows],
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
    # Loi 1 : le mandat lié DOIT appartenir au tenant (404, jamais 403, anti-BOLA).
    if await service.get_mandate(db, company_id, body.mandate_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    listing = await service.create_listing(
        db,
        company_id,
        mandate_id=body.mandate_id,
        list_price=body.list_price,
        title_ar=body.title_ar,
        title_en=body.title_en,
        title_fr=body.title_fr,
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
    body: ListingTransition,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ListingItemOut:
    company_id = _get_company_id(request)
    if await service.get_listing(db, company_id, listing_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    try:
        listing = await service.transition_listing(db, company_id, listing_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if listing is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    return ListingItemOut(data=ListingOut.model_validate(listing))


# ── Offres ───────────────────────────────────────────────────────────────────


@router.get(
    "/offers",
    response_model=OfferListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_offers_endpoint(
    request: Request,
    listing_id: uuid.UUID | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> OfferListOut:
    company_id = _get_company_id(request)
    rows, total = await service.list_offers(
        db, company_id, page=page, limit=limit, listing_id=listing_id, status=status_
    )
    return OfferListOut(
        data=[OfferOut.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/offers",
    response_model=OfferItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def create_offer_endpoint(
    body: OfferCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> OfferItemOut:
    company_id = _get_company_id(request)
    # L'annonce liée doit être dans le tenant (404 anti-BOLA) et l'acheteur ∈ tenant.
    if await service.get_listing(db, company_id, body.listing_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    await _assert_client_in_tenant(db, company_id, body.buyer_client_id)
    offer = await service.create_offer(
        db,
        company_id,
        listing_id=body.listing_id,
        buyer_client_id=body.buyer_client_id,
        amount=body.amount,
    )
    return OfferItemOut(data=OfferOut.model_validate(offer))


@router.get(
    "/offers/{offer_id}",
    response_model=OfferItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_offer_endpoint(
    offer_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> OfferItemOut:
    company_id = _get_company_id(request)
    offer = await service.get_offer(db, company_id, offer_id)
    if offer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="offer_not_found")
    return OfferItemOut(data=OfferOut.model_validate(offer))


@router.post(
    "/offers/{offer_id}/transition",
    response_model=OfferItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def transition_offer_endpoint(
    offer_id: uuid.UUID,
    body: OfferTransition,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> OfferItemOut:
    company_id = _get_company_id(request)
    if await service.get_offer(db, company_id, offer_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="offer_not_found")
    try:
        offer = await service.transition_offer(db, company_id, offer_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if offer is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="offer_not_found")
    return OfferItemOut(data=OfferOut.model_validate(offer))


# ── Transactions ───────────────────────────────────────────────────────────


@router.get(
    "/transactions",
    response_model=TransactionListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_transactions_endpoint(
    request: Request,
    status_: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> TransactionListOut:
    company_id = _get_company_id(request)
    rows, total = await service.list_transactions(
        db, company_id, page=page, limit=limit, status=status_
    )
    return TransactionListOut(
        data=[TransactionOut.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/transactions",
    response_model=TransactionItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def create_transaction_endpoint(
    body: TransactionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TransactionItemOut:
    """Crée une transaction à partir d'une offre `accepted`.

    Valide la chaîne offre → annonce → mandat ∈ tenant (Loi 1, 404 anti-BOLA),
    exige une offre acceptée (409 sinon), puis calcule la commission serveur via
    `compute_commission` à partir du taux du mandat lié.
    """
    company_id = _get_company_id(request)
    offer = await service.get_offer(db, company_id, body.offer_id)
    if offer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="offer_not_found")
    if offer.status != "accepted":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="offer_not_accepted")
    # Anti-double-comptabilisation : une offre acceptée ne peut porter qu'UNE
    # transaction vivante (double POST → double commission sinon).
    if await service.get_live_transaction_for_offer(db, company_id, offer.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="transaction_already_exists"
        )
    listing = await service.get_listing(db, company_id, offer.listing_id)
    if listing is None:  # pragma: no cover - garde-fou intégrité
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    mandate = await service.get_mandate(db, company_id, listing.mandate_id)
    if mandate is None:  # pragma: no cover - garde-fou intégrité
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    transaction = await service.create_transaction_from_offer(
        db,
        company_id,
        offer=offer,
        listing=listing,
        mandate=mandate,
        final_price=body.final_price,
    )
    return TransactionItemOut(data=TransactionOut.model_validate(transaction))


@router.get(
    "/transactions/{transaction_id}",
    response_model=TransactionItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_transaction_endpoint(
    transaction_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TransactionItemOut:
    company_id = _get_company_id(request)
    transaction = await service.get_transaction(db, company_id, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="transaction_not_found")
    return TransactionItemOut(data=TransactionOut.model_validate(transaction))


@router.post(
    "/transactions/{transaction_id}/transition",
    response_model=TransactionItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def transition_transaction_endpoint(
    transaction_id: uuid.UUID,
    body: TransactionTransition,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TransactionItemOut:
    company_id = _get_company_id(request)
    if await service.get_transaction(db, company_id, transaction_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="transaction_not_found")
    try:
        transaction = await service.transition_transaction(
            db, company_id, transaction_id, body.status
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if transaction is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="transaction_not_found")
    return TransactionItemOut(data=TransactionOut.model_validate(transaction))
