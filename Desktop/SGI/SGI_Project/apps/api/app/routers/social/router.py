"""Router FastAPI — Social (publication d'annonces sur les réseaux sociaux).

Tout est filtré par `company_id` (Loi 1), gardé par rôle (`admin`/`manager`/
`agent`). L'annonce ciblée est validée comme appartenant au tenant courant —
anti-BOLA : 404, jamais 403, quand elle n'appartient pas au tenant.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.leasing.models import RentalListing
from app.routers.sales.models import SaleListing
from app.routers.scenarios import service as scenarios_service
from app.routers.social import service
from app.routers.social.schemas import (
    ChannelsOut,
    PostCreate,
    PostDetailOut,
    PostListOut,
)

router = APIRouter(prefix="/social", tags=["social"])

_ROLES = ("admin", "manager", "agent")


async def _listing_belongs_to_tenant(
    db: AsyncSession, company_id: uuid.UUID, listing_type: str, listing_id: uuid.UUID
) -> bool:
    model = SaleListing if listing_type == "sale" else RentalListing
    row = (
        await db.execute(
            select(model.id).where(
                model.id == listing_id,
                model.company_id == company_id,
                model.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    return row is not None


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "social", "status": "ok"}


@router.get("/channels", response_model=ChannelsOut, dependencies=[Depends(require_roles(*_ROLES))])
async def channels_endpoint() -> ChannelsOut:
    return ChannelsOut(data=list(service.SOCIAL_CHANNELS))


@router.get("/posts", response_model=PostListOut, dependencies=[Depends(require_roles(*_ROLES))])
async def list_posts_endpoint(
    listing_type: str | None = Query(None, pattern="^(sale|rent)$"),
    listing_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
) -> PostListOut:
    company_id = await get_company_id(db)
    posts = await service.list_posts(
        db, company_id, listing_type=listing_type, listing_id=listing_id
    )
    return PostListOut(data=[await service.post_to_out(db, company_id, p) for p in posts])


@router.post(
    "/posts",
    response_model=PostDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*_ROLES))],
)
async def publish_endpoint(
    body: PostCreate,
    db: AsyncSession = Depends(get_db_session),
) -> PostDetailOut:
    company_id = await get_company_id(db)
    if not service.is_valid_channel(body.channel):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_channel")
    if not await _listing_belongs_to_tenant(db, company_id, body.listing_type, body.listing_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    external_url = body.external_url
    # Si une vidéo générée est attachée : la valider (tenant + même annonce ;
    # anti-BOLA : 404 hors tenant). On NE fige PAS son URL ici — elle est re-signée
    # à la lecture (service.post_to_out) pour ne jamais périmer (cf. fix « Voir »).
    if body.video_scenario_id is not None:
        scenario = await scenarios_service.get_scenario(db, company_id, body.video_scenario_id)
        if (
            scenario is None
            or scenario.listing_type != body.listing_type
            or scenario.listing_id != body.listing_id
        ):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="scenario_not_found")
    post = await service.publish(
        db,
        company_id,
        listing_type=body.listing_type,
        listing_id=body.listing_id,
        channel=body.channel,
        message=body.message,
        external_url=external_url,
        video_scenario_id=body.video_scenario_id,
    )
    return PostDetailOut(data=await service.post_to_out(db, company_id, post))


@router.delete(
    "/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*_ROLES))],
)
async def unpublish_endpoint(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    post = await service.unpublish(db, company_id, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="post_not_found")
