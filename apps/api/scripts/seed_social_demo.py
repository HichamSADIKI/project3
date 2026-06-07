"""Seed démo — Social posts : publie des annonces démo sur des canaux sociaux.

Cible la société `infinity-uae`. Idempotent (un seul post actif par annonce/canal
via le service). Résout les annonces par référence.

Lancer : docker compose exec api uv run python -m scripts.seed_social_demo
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.company import Company
from app.routers.leasing.models import RentalListing
from app.routers.sales.models import SaleListing
from app.routers.social import service

COMPANY_SLUG = "infinity-uae"

# (listing_type, référence, [canaux])
SALE_POSTS = [
    ("SALE-2026-910005", ["facebook", "instagram", "tiktok"]),  # Villa Palm Jumeirah
    ("SALE-2026-910002", ["facebook", "linkedin"]),  # Retail Showroom
    ("SALE-2026-910003", ["linkedin"]),  # Mixed-Use Commercial
    ("SALE-2026-910001", ["facebook", "instagram", "linkedin", "x"]),  # Office Business Bay
]
RENT_POSTS = [
    ("LEAS-2026-920001", ["facebook", "instagram", "whatsapp"]),  # Marina Gate 1BR
    ("LEAS-2026-920003", ["instagram", "snapchat"]),  # Jumeirah Park Villa
    ("LEAS-2026-920002", ["facebook", "whatsapp"]),  # Burj Vista 2BR
]


async def _resolve(db: AsyncSession, model, company_id, reference):
    return (
        await db.execute(
            select(model.id).where(model.company_id == company_id, model.reference == reference)
        )
    ).scalar_one_or_none()


async def seed(db: AsyncSession) -> None:
    company_id = (
        await db.execute(select(Company.id).where(Company.slug == COMPANY_SLUG))
    ).scalar_one_or_none()
    if company_id is None:
        raise SystemExit(f"Société '{COMPANY_SLUG}' introuvable.")

    created = 0
    for ref, channels in SALE_POSTS:
        lid = await _resolve(db, SaleListing, company_id, ref)
        if lid is None:
            print(f"  ⚠ vente {ref} introuvable, ignorée")
            continue
        for ch in channels:
            await service.publish(db, company_id, listing_type="sale", listing_id=lid, channel=ch)
            created += 1
    for ref, channels in RENT_POSTS:
        lid = await _resolve(db, RentalListing, company_id, ref)
        if lid is None:
            print(f"  ⚠ location {ref} introuvable, ignorée")
            continue
        for ch in channels:
            await service.publish(db, company_id, listing_type="rent", listing_id=lid, channel=ch)
            created += 1

    total = len(await service.list_posts(db, company_id))
    print(f"✅ Seed Social : {created} publications traitées ; {total} posts actifs au total.")


async def main() -> None:
    async with async_session_maker() as db:
        await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
