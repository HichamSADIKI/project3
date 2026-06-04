"""Service Social — helpers purs + fonctions DB (filtrées company_id, Loi 1).

Publication d'une annonce (vente/location) sur un canal social. En MVP la
"publication" est enregistrée (stub) : pas d'appel réel aux API Meta/X — un
connecteur réel viendra ensuite. La table garde la provenance + un seul post
ACTIF par (annonce, canal).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.scenarios import service as scenarios_service
from app.routers.social.models import SocialPost
from app.routers.social.schemas import PostOut

# Canaux supportés — DOIVENT correspondre EXACTEMENT au CHECK (migration 0042).
SOCIAL_CHANNELS: tuple[str, ...] = (
    "facebook",
    "instagram",
    "linkedin",
    "x",
    "whatsapp",
    "tiktok",
    "snapchat",
)
LISTING_TYPES: frozenset[str] = frozenset({"sale", "rent"})


# ── Helpers purs (sans DB) ───────────────────────────────────────────────────


def is_valid_channel(channel: str) -> bool:
    return channel in SOCIAL_CHANNELS


def is_valid_listing_type(listing_type: str) -> bool:
    return listing_type in LISTING_TYPES


def build_share_url(channel: str, public_url: str) -> str:
    """URL de partage du canal (stub déterministe — pas d'appel réseau)."""
    from urllib.parse import quote

    u = quote(public_url, safe="")
    match channel:
        case "facebook":
            return f"https://www.facebook.com/sharer/sharer.php?u={u}"
        case "linkedin":
            return f"https://www.linkedin.com/sharing/share-offsite/?url={u}"
        case "x":
            return f"https://twitter.com/intent/tweet?url={u}"
        case "whatsapp":
            return f"https://wa.me/?text={u}"
        case _:
            # instagram / tiktok / snapchat : pas d'URL de partage web standard.
            return public_url


# ── Fonctions DB (Loi 1 : toujours filtrer company_id) ───────────────────────


async def post_to_out(db: AsyncSession, company_id: uuid.UUID, post: SocialPost) -> PostOut:
    """Sérialise un post en **re-signant l'URL vidéo à la lecture**.

    Si le post porte une vidéo (`video_scenario_id`), on récupère l'URL FRAÎCHE du
    scénario (presign-on-read, cf. `scenarios.service.scenario_to_out`) au lieu de
    renvoyer un `external_url` figé — qui était une URL présignée MinIO périmant à
    7 jours. Repli : si le scénario a disparu ou n'a pas d'URL, on garde l'external_url
    stocké. N+1 borné en pratique (1 post actif par (tenant, annonce, canal)).
    """
    out = PostOut.model_validate(post)
    if post.video_scenario_id is not None:
        scenario = await scenarios_service.get_scenario(db, company_id, post.video_scenario_id)
        if scenario is not None:
            fresh = (await scenarios_service.scenario_to_out(scenario)).video_url
            if fresh:
                out.external_url = fresh
    return out


async def list_posts(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_type: str | None = None,
    listing_id: uuid.UUID | None = None,
    limit: int = 500,
) -> list[SocialPost]:
    """Posts actifs du tenant, filtrables par annonce (pour badges + modale)."""
    q = select(SocialPost).where(
        SocialPost.company_id == company_id,
        SocialPost.deleted_at.is_(None),
    )
    if listing_type is not None:
        q = q.where(SocialPost.listing_type == listing_type)
    if listing_id is not None:
        q = q.where(SocialPost.listing_id == listing_id)
    q = q.order_by(SocialPost.created_at.desc()).limit(limit)
    return list((await db.execute(q)).scalars().all())


async def get_active_post(
    db: AsyncSession,
    company_id: uuid.UUID,
    listing_type: str,
    listing_id: uuid.UUID,
    channel: str,
) -> SocialPost | None:
    q = select(SocialPost).where(
        SocialPost.company_id == company_id,
        SocialPost.listing_type == listing_type,
        SocialPost.listing_id == listing_id,
        SocialPost.channel == channel,
        SocialPost.deleted_at.is_(None),
    )
    return (await db.execute(q)).scalar_one_or_none()


async def publish(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_type: str,
    listing_id: uuid.UUID,
    channel: str,
    message: str | None = None,
    external_url: str | None = None,
    video_scenario_id: uuid.UUID | None = None,
) -> SocialPost:
    """Publie (ou met à jour l'existant) sur un canal. Idempotent par (annonce, canal).

    Si une vidéo (`video_scenario_id`) est fournie et que le post existe déjà sur
    ce canal, on l'enrichit (attache la vidéo + son URL) au lieu de l'ignorer —
    publier une vidéo sur un canal déjà utilisé doit prendre effet.
    """
    existing = await get_active_post(db, company_id, listing_type, listing_id, channel)
    if existing is not None:
        if video_scenario_id is not None and existing.video_scenario_id != video_scenario_id:
            existing.video_scenario_id = video_scenario_id
            if external_url:
                existing.external_url = external_url
            existing.updated_at = datetime.now(UTC)
            await db.commit()
            await db.refresh(existing)
        return existing
    now = datetime.now(UTC)
    post = SocialPost(
        company_id=company_id,
        listing_type=listing_type,
        listing_id=listing_id,
        channel=channel,
        status="published",
        message=message,
        external_url=external_url,
        video_scenario_id=video_scenario_id,
        published_at=now,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def unpublish(
    db: AsyncSession, company_id: uuid.UUID, post_id: uuid.UUID
) -> SocialPost | None:
    """Retire un post d'un canal (soft delete). None si hors tenant / introuvable."""
    q = select(SocialPost).where(
        SocialPost.id == post_id,
        SocialPost.company_id == company_id,
        SocialPost.deleted_at.is_(None),
    )
    post = (await db.execute(q)).scalar_one_or_none()
    if post is None:
        return None
    post.deleted_at = datetime.now(UTC)
    post.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(post)
    return post
