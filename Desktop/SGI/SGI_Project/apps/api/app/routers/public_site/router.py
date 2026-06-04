"""Router FastAPI — vitrine immobilière publique (SANS JWT).

Monté sous `/api/v1` mais INDÉPENDANT de `request.state.company_id` : la
dépendance `get_public_db` résout `settings.PUBLIC_SITE_COMPANY_SLUG → company_id`
et pose le GUC RLS manuellement (la RLS reste active sans middleware tenant).

Fail-safe : si le slug n'est pas configuré/introuvable → listings/stats vides,
détail 404, lead 200 silencieux. Jamais de 500 sur input client.
"""

import logging
import uuid
from collections.abc import AsyncIterator
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.routers.public_site import service
from app.routers.public_site.schemas import (
    AgentDetailEnvelope,
    AgentsListEnvelope,
    LeadCreatedOut,
    ListingDetailEnvelope,
    ListingsListOut,
    PublicAgentProfile,
    PublicAgentProfileDetail,
    PublicLeadBody,
    PublicListingDetailOut,
    PublicListingOut,
    PublicStatsOut,
    StatsEnvelope,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public_site"])


async def get_public_db(
    db: AsyncSession = Depends(get_db),
) -> AsyncIterator[tuple[AsyncSession, uuid.UUID | None]]:
    """Résout la société publique + pose le GUC RLS. Yield (db, company_id|None).

    company_id None = vitrine non configurée/introuvable → l'appelant applique le
    comportement fail-safe (vide / 404), jamais d'erreur.

    **Fail-closed** : on efface le GUC en fin de requête (`finally`) — la
    connexion `get_db` provient d'un pool, et le GUC posé au niveau session
    survivrait au retour en pool (fuite résiduelle de la société vitrine). Même
    contrat que `get_db_session`.
    """
    company_id = await service.get_public_company_id(db)
    if company_id is not None:
        await service.set_tenant_guc(db, company_id)
    try:
        yield db, company_id
    finally:
        await service.clear_tenant_guc(db)


# ── Rate-limit léger (best-effort, en mémoire process) ───────────────────────
# Anti-abus simple sur la capture de lead. Non distribué (suffisant en MVP, le
# vrai rempart est la validation Pydantic). TTL court par IP.
_LEAD_HITS: dict[str, list[float]] = {}
_LEAD_WINDOW_S = 60.0
_LEAD_MAX = 10


def _rate_limited(ip: str) -> bool:
    import time

    now = time.monotonic()
    # Purge best-effort des IP dont toutes les entrées ont expiré : borne la
    # croissance mémoire sous trafic varié (le store est process-local, MVP).
    if len(_LEAD_HITS) > 1024:
        for stale in [
            k for k, ts in _LEAD_HITS.items() if all(now - t >= _LEAD_WINDOW_S for t in ts)
        ]:
            _LEAD_HITS.pop(stale, None)
    hits = [t for t in _LEAD_HITS.get(ip, []) if now - t < _LEAD_WINDOW_S]
    if len(hits) >= _LEAD_MAX:
        _LEAD_HITS[ip] = hits
        return True
    hits.append(now)
    _LEAD_HITS[ip] = hits
    return False


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "public_site", "status": "ok"}


@router.get("/listings", response_model=ListingsListOut)
async def list_listings_endpoint(
    q: str | None = Query(None, max_length=120),
    deal: str | None = Query(None, pattern="^(sale|rent)$"),
    city: str | None = Query(None, max_length=120),
    emirate: str | None = Query(None, max_length=3),
    unit_type: str | None = Query(None, max_length=30),
    price_min: Decimal | None = Query(None, ge=0),
    price_max: Decimal | None = Query(None, ge=0),
    bedrooms: int | None = Query(None, ge=0, le=50),
    sort: str | None = Query(None, pattern="^(price_asc|price_desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=48),
    ctx: tuple[AsyncSession, uuid.UUID | None] = Depends(get_public_db),
) -> ListingsListOut:
    db, company_id = ctx
    if company_id is None:
        return ListingsListOut(data=[], meta={"total": 0, "page": page, "limit": limit})
    # Recherche full-text (Meilisearch, typo-tolérante) si un mot-clé est fourni ;
    # fallback DB transparent si Meili indisponible. Sinon, liste filtrée DB classique.
    if q and q.strip():
        rows, total = await service.search_listings(
            db, company_id, q.strip(), deal=deal, limit=limit
        )
        return ListingsListOut(
            data=[PublicListingOut.model_validate(r) for r in rows],
            meta={"total": total, "page": 1, "limit": limit},
        )
    rows, total = await service.list_public_listings(
        db,
        company_id,
        deal=deal,
        city=city,
        emirate=emirate,
        unit_type=unit_type,
        price_min=price_min,
        price_max=price_max,
        bedrooms=bedrooms,
        sort=sort,
        page=page,
        limit=limit,
    )
    return ListingsListOut(
        data=[PublicListingOut.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.get("/stats", response_model=StatsEnvelope)
async def stats_endpoint(
    ctx: tuple[AsyncSession, uuid.UUID | None] = Depends(get_public_db),
) -> StatsEnvelope:
    db, company_id = ctx
    if company_id is None:
        return StatsEnvelope(data=PublicStatsOut())
    stats = await service.public_stats(db, company_id)
    return StatsEnvelope(data=PublicStatsOut.model_validate(stats))


@router.get("/agents", response_model=AgentsListEnvelope)
async def list_agents_endpoint(
    ctx: tuple[AsyncSession, uuid.UUID | None] = Depends(get_public_db),
) -> AgentsListEnvelope:
    db, company_id = ctx
    if company_id is None:
        return AgentsListEnvelope(data=[])
    agents = await service.list_public_agents(db, company_id)
    return AgentsListEnvelope(data=[PublicAgentProfile.model_validate(a) for a in agents])


@router.get("/agents/{slug}", response_model=AgentDetailEnvelope)
async def get_agent_endpoint(
    slug: str,
    ctx: tuple[AsyncSession, uuid.UUID | None] = Depends(get_public_db),
) -> AgentDetailEnvelope:
    db, company_id = ctx
    if company_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    agent = await service.get_public_agent(db, company_id, slug)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    # Annonces de l'agence (pas de lien agent↔annonce dédié → vitrine agence).
    rows, _ = await service.list_public_listings(db, company_id, page=1, limit=12)
    return AgentDetailEnvelope(
        data=PublicAgentProfileDetail.model_validate(agent),
        listings=[PublicListingOut.model_validate(r) for r in rows],
    )


@router.get("/listings/{slug}", response_model=ListingDetailEnvelope)
async def get_listing_endpoint(
    slug: str,
    ctx: tuple[AsyncSession, uuid.UUID | None] = Depends(get_public_db),
) -> ListingDetailEnvelope:
    db, company_id = ctx
    if company_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    row = await service.get_public_listing(db, company_id, slug)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return ListingDetailEnvelope(data=PublicListingDetailOut.model_validate(row))


@router.post("/leads", response_model=LeadCreatedOut, status_code=status.HTTP_201_CREATED)
async def create_lead_endpoint(
    body: PublicLeadBody,
    request: Request,
    ctx: tuple[AsyncSession, uuid.UUID | None] = Depends(get_public_db),
) -> LeadCreatedOut:
    """Capture un lead public. Jamais 500 : input invalide → 422 (Pydantic),
    vitrine non configurée → accusé silencieux, erreur interne → log + accusé.
    """
    db, company_id = ctx
    # Au moins un moyen de contact (sinon le lead est inexploitable).
    if not body.contact.email and not body.contact.phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="contact_required"
        )

    client_ip = request.client.host if request.client else "unknown"
    if _rate_limited(client_ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limited")

    if company_id is None:
        # Fail-safe : vitrine non configurée → accusé silencieux, rien n'est persisté.
        return LeadCreatedOut(data={"received": True})

    try:
        await service.capture_public_lead(
            db,
            company_id,
            contact=body.contact.model_dump(),
            listing_slug=body.listing_slug,
            message=body.message,
        )
    except Exception:  # noqa: BLE001  surface publique : jamais de 500 / stacktrace
        logger.exception("public lead capture failed")
        try:
            await db.rollback()
        except Exception:  # noqa: S110
            pass
        return LeadCreatedOut(data={"received": True})

    return LeadCreatedOut(data={"received": True})
