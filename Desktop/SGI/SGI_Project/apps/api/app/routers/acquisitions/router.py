"""Router FastAPI — Acquisitions (côté acquéreur, sous-catégorie « Achat »).

Mandats d'achat + offres + moteur de rapprochement PostGIS. Tout est filtré par
`company_id` (Loi 1) et gardé par RBAC (`admin`/`manager`/`agent`). Anti-BOLA :
une cible hors tenant renvoie 404 (jamais 403). Toute FK fournie (client,
mandat, bien) est validée comme appartenant au tenant.
"""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.client import Client
from app.models.property import Property
from app.routers.acquisitions import service
from app.routers.acquisitions.schemas import (
    AcquisitionsPipelineOut,
    MandateCreate,
    MandateItemOut,
    MandateListOut,
    MandateOut,
    MandateTransitionBody,
    MatchListOut,
    OfferCreate,
    OfferItemOut,
    OfferListOut,
    OfferOut,
    OfferTransitionBody,
)

router = APIRouter(prefix="/acquisitions", tags=["acquisitions"])

_WRITE_ROLES = ("admin", "manager", "agent")


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


def _get_user_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "user_id", None)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_context_missing")
    return uuid.UUID(raw)


def _require_roles(*allowed_roles: str) -> Callable[[Request], Awaitable[None]]:
    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions"
            )

    return _check


async def _assert_client_in_company(
    db: AsyncSession, company_id: uuid.UUID, client_id: uuid.UUID
) -> None:
    """Valide qu'un client appartient au tenant (Loi 1). La FK clients.id
    contourne la RLS → vérification explicite côté propriétaire de la table."""
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


async def _assert_property_in_company(
    db: AsyncSession, company_id: uuid.UUID, property_id: uuid.UUID
) -> None:
    """Valide qu'un bien appartient au tenant (Loi 1)."""
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
    return {"module": "acquisitions", "status": "ok"}


@router.get(
    "/pipeline",
    response_model=AcquisitionsPipelineOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def acquisitions_pipeline_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> AcquisitionsPipelineOut:
    """Synthèse du pipeline d'acquisition : mandats et offres d'achat par statut,
    avec le montant des offres soumises et la valeur des offres acceptées."""
    company_id = _get_company_id(request)
    summary = await service.acquisitions_pipeline_summary(db, company_id)
    return AcquisitionsPipelineOut(data=summary, meta={})


# ── Mandats d'achat ──────────────────────────────────────────────────────────


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
    mandates, total = await service.list_mandates(
        db, company_id, page=page, limit=limit, status=status_
    )
    return MandateListOut(
        data=[MandateOut.model_validate(m) for m in mandates],
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
    # Loi 1 : l'acquéreur DOIT appartenir au tenant.
    await _assert_client_in_company(db, company_id, body.buyer_client_id)
    mandate = await service.create_mandate(
        db,
        company_id,
        buyer_client_id=body.buyer_client_id,
        budget_min=body.budget_min,
        budget_max=body.budget_max,
        property_type=body.property_type,
        bedrooms_min=body.bedrooms_min,
        latitude=body.latitude,
        longitude=body.longitude,
        search_radius_m=body.search_radius_m,
        notes=body.notes,
        signed_at=body.signed_at,
        expires_at=body.expires_at,
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
    body: MandateTransitionBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MandateItemOut:
    company_id = _get_company_id(request)
    # 404 d'abord si hors tenant (anti-BOLA : ne pas révéler l'existence).
    if await service.get_mandate(db, company_id, mandate_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    try:
        mandate = await service.transition_mandate(db, company_id, mandate_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if mandate is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    return MandateItemOut(data=MandateOut.model_validate(mandate))


@router.get(
    "/mandates/{mandate_id}/matches",
    response_model=MatchListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def mandate_matches_endpoint(
    mandate_id: uuid.UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
) -> MatchListOut:
    """Moteur de rapprochement : biens du tenant scorés pour ce mandat (Loi 2)."""
    company_id = _get_company_id(request)
    mandate = await service.get_mandate(db, company_id, mandate_id)
    if mandate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    matches = await service.find_matches(db, company_id, mandate, limit=limit)
    return MatchListOut(data=matches, meta={"total": len(matches), "mandate_id": str(mandate_id)})


# ── Offres d'achat ───────────────────────────────────────────────────────────


@router.get(
    "/offers",
    response_model=OfferListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_offers_endpoint(
    request: Request,
    mandate_id: uuid.UUID | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> OfferListOut:
    company_id = _get_company_id(request)
    offers, total = await service.list_offers(
        db, company_id, page=page, limit=limit, mandate_id=mandate_id, status=status_
    )
    return OfferListOut(
        data=[OfferOut.model_validate(o) for o in offers],
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
    # Loi 1 : le mandat ET le bien doivent appartenir au tenant. Mandat hors
    # tenant → 404 (anti-BOLA : ne pas révéler son existence) ; bien hors
    # tenant → 400 (référence métier explicitement invalide).
    if await service.get_mandate(db, company_id, body.mandate_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mandate_not_found")
    await _assert_property_in_company(db, company_id, body.property_id)
    offer = await service.create_offer(
        db,
        company_id,
        mandate_id=body.mandate_id,
        property_id=body.property_id,
        amount=body.amount,
        notes=body.notes,
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
    body: OfferTransitionBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> OfferItemOut:
    company_id = _get_company_id(request)
    # 404 d'abord si hors tenant (anti-BOLA).
    if await service.get_offer(db, company_id, offer_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="offer_not_found")
    try:
        offer = await service.transition_offer(db, company_id, offer_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if offer is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="offer_not_found")
    return OfferItemOut(data=OfferOut.model_validate(offer))
