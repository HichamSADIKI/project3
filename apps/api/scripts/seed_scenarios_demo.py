"""Seed démo — Scénarios vidéo (module `scenarios`) pour Vente ET Location.

Attache des **scénarios vidéo prêts** (statut `ready` + URL vidéo de démo) à des
annonces existantes de **vente** (`sale_listings`) et de **location**
(`rental_listings`) de la société `infinity-uae`, afin de montrer la fonction
« Générer une vidéo » dans les écrans **Vente** et **Location** du back-office.

Pré-requis : les annonces doivent exister (lancer d'abord `seed_sale_demo` et
`seed_rental_demo`). Idempotent : un seul scénario actif par annonce — relancer
ne duplique rien. Tout porte `company_id` (Loi 1) ; les `photo_refs` sont au
namespace du tenant (`scenarios/{company_id}/...`, cf. `service.owns_ref`).

Le statut est posé directement à `ready` avec une URL vidéo placeholder (la vraie
génération FFmpeg passe par la tâche Celery `app.tasks.scenarios.generate`) — ici
on veut juste une démo visible sans dépendre du worker/ffmpeg.

Lancer dans le conteneur api :
    docker compose exec api uv run python -m scripts.seed_scenarios_demo
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.company import Company
from app.routers.leasing.models import RentalListing
from app.routers.sales.models import SaleListing
from app.routers.scenarios.models import VideoScenario
from app.routers.scenarios.service import stub_video_url

COMPANY_SLUG = "infinity-uae"
PER_TYPE = 3  # nombre de scénarios démo par type (vente / location)

# Petit script marketing FR par défaut (la voix d'avatar le lirait en TTS).
_SCRIPT = (
    "Découvrez ce bien d'exception signé Infinity. Emplacement premium, "
    "prestations haut de gamme — réservez votre visite dès aujourd'hui."
)


async def _seed_for(
    session: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_type: str,
    listings: list,
) -> int:
    created = 0
    for i, lst in enumerate(listings):
        # Idempotence : un seul scénario actif par (tenant, type, annonce).
        existing = (
            await session.execute(
                select(VideoScenario.id).where(
                    VideoScenario.company_id == company_id,
                    VideoScenario.listing_type == listing_type,
                    VideoScenario.listing_id == lst.id,
                    VideoScenario.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            continue

        title = lst.title_fr or lst.title_en or lst.title_ar or f"Annonce {listing_type}"
        avatar = "female" if i % 2 == 0 else "male"
        sid = uuid.uuid4()
        # Refs photos au namespace du tenant (démo : non téléchargées car ready).
        photo_refs = [
            f"scenarios/{company_id}/photo/demo-{listing_type}-{i + 1}-{n}.jpg" for n in (1, 2, 3)
        ]
        session.add(
            VideoScenario(
                id=sid,
                company_id=company_id,
                listing_type=listing_type,
                listing_id=lst.id,
                title=f"Reel — {title}",
                voice_mode="avatar",
                avatar=avatar,
                script=_SCRIPT,
                photo_refs=photo_refs,
                status="ready",
                video_url=stub_video_url(sid),
                error=None,
            )
        )
        created += 1
    await session.commit()
    return created


async def seed(session: AsyncSession) -> None:
    company_id = (
        await session.execute(select(Company.id).where(Company.slug == COMPANY_SLUG))
    ).scalar_one_or_none()
    if company_id is None:
        raise SystemExit(f"Société '{COMPANY_SLUG}' introuvable — lancer d'abord make seed.")

    await session.execute(
        text("SELECT set_config('app.current_company_id', :cid, false)"),
        {"cid": str(company_id)},
    )

    sales = list(
        (
            await session.execute(
                select(SaleListing)
                .where(
                    SaleListing.company_id == company_id,
                    SaleListing.status == "published",
                    SaleListing.deleted_at.is_(None),
                )
                .order_by(SaleListing.id)
                .limit(PER_TYPE)
            )
        )
        .scalars()
        .all()
    )
    rents = list(
        (
            await session.execute(
                select(RentalListing)
                .where(
                    RentalListing.company_id == company_id,
                    RentalListing.status == "published",
                    RentalListing.deleted_at.is_(None),
                )
                .order_by(RentalListing.id)
                .limit(PER_TYPE)
            )
        )
        .scalars()
        .all()
    )

    if not sales:
        print("⚠️  Aucune annonce de vente publiée — lancer `seed_sale_demo` d'abord.")
    if not rents:
        print("⚠️  Aucune annonce de location publiée — lancer `seed_rental_demo` d'abord.")

    n_sale = await _seed_for(session, company_id, listing_type="sale", listings=sales)
    n_rent = await _seed_for(session, company_id, listing_type="rent", listings=rents)

    print(
        f"✅ Scénarios démo : vente +{n_sale} (sur {len(sales)} annonces), "
        f"location +{n_rent} (sur {len(rents)} annonces) pour '{COMPANY_SLUG}'."
    )


async def main() -> None:
    async with async_session_maker() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
