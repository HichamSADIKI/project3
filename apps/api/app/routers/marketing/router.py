"""Router FastAPI — Marketing.

Campagnes de diffusion (vente ET location) reliant des unités à un canal, des
métriques, une publication via connecteurs STUBS, et la boucle de retour
`inbound-lead` qui alimente le CRM existant.

Tout est filtré par `company_id` (Loi 1), gardé par rôle (`admin`/`manager`/
`agent`), et chaque FK fournie (unit_id, client_id) est validée comme appartenant
au tenant courant. Anti-BOLA : 404 — jamais 403 — quand la cible n'appartient
pas au tenant (ne révèle pas son existence).
"""

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.unit import Unit
from app.routers.marketing import service
from app.routers.marketing.connectors import get_connector
from app.routers.marketing.schemas import (
    AttachUnitsBody,
    CampaignCreate,
    CampaignItemOut,
    CampaignListOut,
    CampaignOut,
    CampaignTransitionBody,
    CampaignUnitListOut,
    CampaignUnitOut,
    CampaignUpdate,
    InboundLeadBody,
    InboundLeadItemOut,
    InboundLeadResult,
    KpisItemOut,
    KpisOut,
)

router = APIRouter(prefix="/marketing", tags=["marketing"])

_WRITE_ROLES = ("admin", "manager", "agent")


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    try:
        return uuid.UUID(raw)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        ) from None


def _get_actor_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "user_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    try:
        return uuid.UUID(raw)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        ) from None


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


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "marketing", "status": "ok"}


# ── Campagnes ──────────────────────────────────────────────────────────────


@router.get(
    "/campaigns",
    response_model=CampaignListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_campaigns_endpoint(
    request: Request,
    status_: str | None = Query(None, alias="status"),
    channel: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> CampaignListOut:
    company_id = _get_company_id(request)
    campaigns, total = await service.list_campaigns(
        db, company_id, page=page, limit=limit, status=status_, channel=channel
    )
    return CampaignListOut(
        data=[CampaignOut.model_validate(item) for item in campaigns],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/campaigns",
    response_model=CampaignItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def create_campaign_endpoint(
    body: CampaignCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CampaignItemOut:
    company_id = _get_company_id(request)
    if not service.is_valid_channel(body.channel):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_channel")
    campaign = await service.create_campaign(
        db,
        company_id,
        name=body.name,
        channel=body.channel,
        starts_on=body.starts_on,
        ends_on=body.ends_on,
        budget_aed=body.budget_aed,
        notes=body.notes,
    )
    return CampaignItemOut(data=CampaignOut.model_validate(campaign))


@router.get(
    "/campaigns/{campaign_id}",
    response_model=CampaignItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_campaign_endpoint(
    campaign_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CampaignItemOut:
    company_id = _get_company_id(request)
    campaign = await service.get_campaign(db, company_id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="campaign_not_found")
    return CampaignItemOut(data=CampaignOut.model_validate(campaign))


@router.patch(
    "/campaigns/{campaign_id}",
    response_model=CampaignItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def update_campaign_endpoint(
    campaign_id: uuid.UUID,
    body: CampaignUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CampaignItemOut:
    company_id = _get_company_id(request)
    campaign = await service.update_campaign(
        db,
        company_id,
        campaign_id,
        name=body.name,
        starts_on=body.starts_on,
        ends_on=body.ends_on,
        budget_aed=body.budget_aed,
        spend_aed=body.spend_aed,
        notes=body.notes,
    )
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="campaign_not_found")
    return CampaignItemOut(data=CampaignOut.model_validate(campaign))


@router.post(
    "/campaigns/{campaign_id}/transition",
    response_model=CampaignItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def transition_campaign_endpoint(
    campaign_id: uuid.UUID,
    body: CampaignTransitionBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CampaignItemOut:
    company_id = _get_company_id(request)
    # 404 anti-BOLA si la campagne n'appartient pas au tenant.
    if await service.get_campaign(db, company_id, campaign_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="campaign_not_found")
    try:
        campaign = await service.transition_campaign(db, company_id, campaign_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if campaign is None:  # pragma: no cover - garde-fou course
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="campaign_not_found")
    return CampaignItemOut(data=CampaignOut.model_validate(campaign))


@router.post(
    "/campaigns/{campaign_id}/publish",
    response_model=CampaignItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def publish_campaign_endpoint(
    campaign_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CampaignItemOut:
    company_id = _get_company_id(request)
    campaign = await service.get_campaign(db, company_id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="campaign_not_found")
    units = await service.list_campaign_units(db, company_id, campaign_id)
    unit_ids = [u.unit_id for u in units]
    connector = get_connector(campaign.channel)
    result = connector.publish(campaign.id, campaign.reference, unit_ids)
    campaign.external_ref = result.external_ref
    campaign.published_at = datetime.now(UTC)
    campaign.updated_at = datetime.now(UTC)
    await db.commit()
    # Enregistre les métriques initiales renvoyées par le connecteur stub.
    await service.record_metrics(
        db,
        company_id,
        campaign_id,
        impressions=result.impressions,
        clicks=result.clicks,
    )
    refreshed = await service.get_campaign(db, company_id, campaign_id)
    return CampaignItemOut(data=CampaignOut.model_validate(refreshed))


# ── Unités liées ─────────────────────────────────────────────────────────────


@router.post(
    "/campaigns/{campaign_id}/units",
    response_model=CampaignUnitListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def attach_units_endpoint(
    campaign_id: uuid.UUID,
    body: AttachUnitsBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CampaignUnitListOut:
    company_id = _get_company_id(request)
    if await service.get_campaign(db, company_id, campaign_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="campaign_not_found")
    # Loi 1 : chaque unité DOIT appartenir au tenant.
    for unit_id in body.unit_ids:
        await _assert_unit_in_company(db, company_id, unit_id)
    links = await service.attach_units(db, company_id, campaign_id, body.unit_ids)
    return CampaignUnitListOut(
        data=[CampaignUnitOut.model_validate(link) for link in links],
        meta={"total": len(links)},
    )


@router.delete(
    "/campaigns/{campaign_id}/units/{unit_id}",
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def detach_unit_endpoint(
    campaign_id: uuid.UUID,
    unit_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    company_id = _get_company_id(request)
    if await service.get_campaign(db, company_id, campaign_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="campaign_not_found")
    removed = await service.detach_unit(db, company_id, campaign_id, unit_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_link_not_found")
    return {"success": True}


# ── Boucle de retour leads ─────────────────────────────────────────────────


@router.post(
    "/campaigns/{campaign_id}/inbound-lead",
    response_model=InboundLeadItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def inbound_lead_endpoint(
    campaign_id: uuid.UUID,
    body: InboundLeadBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> InboundLeadItemOut:
    company_id = _get_company_id(request)
    actor_id = _get_actor_id(request)
    campaign = await service.get_campaign(db, company_id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="campaign_not_found")
    if (
        body.client_id is None
        and not body.contact.email
        and not body.contact.phone
        and not body.contact.name
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="no_contact")
    try:
        lead = await service.record_inbound_lead(
            db,
            company_id,
            campaign,
            actor_user_id=actor_id,
            client_id=body.client_id,
            contact=body.contact.model_dump(),
            message=body.message,
            budget=body.budget,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    refreshed = await service.get_campaign(db, company_id, campaign_id)
    return InboundLeadItemOut(
        data=InboundLeadResult(
            lead_id=lead.id,
            client_id=lead.client_id,
            reference=lead.reference or "",
            score=lead.score,
            source=lead.source or "",
            leads_count=refreshed.leads_count if refreshed else campaign.leads_count,
        )
    )


# ── KPIs ──────────────────────────────────────────────────────────────────


@router.get(
    "/kpis",
    response_model=KpisItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def kpis_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> KpisItemOut:
    company_id = _get_company_id(request)
    kpis = await service.get_marketing_kpis(db, company_id)
    return KpisItemOut(data=KpisOut.model_validate(kpis))
