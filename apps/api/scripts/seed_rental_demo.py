"""Seed démo — Location (module `leasing`) pour la vitrine publique.

Crée un jeu de biens à LOUER cohérent Dubai / Abu Dhabi pour la société
`infinity-uae`, prêt à tester de bout en bout :

    buildings  →  units  →  rental_listings (status='published')

Les annonces publiées apparaissent dans l'écran **Location** du back-office
(admin `infinity-uae`) ET sur la **vitrine publique** (`/api/v1/public`, deal=rent).

Idempotent : UUID figés → relancer ne duplique rien. Tout porte `company_id`
(Loi 1). Images = URLs externes (tolérées telles quelles par la vitrine).
Tags UUID dédiés (0xBA/0xBC/0x6C) pour éviter la collision avec
`seed_realestate.py` (qui occupe 0xB1/0xB2/0xB3).

Lancer dans le conteneur api :
    docker compose exec api uv run python -m scripts.seed_rental_demo
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from geoalchemy2.elements import WKTElement
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.building import Building
from app.models.company import Company
from app.models.unit import Unit
from app.routers.leasing.models import RentalListing

COMPANY_SLUG = "infinity-uae"


def _uid(tag: int, n: int) -> uuid.UUID:
    return uuid.UUID(f"{tag:08x}-0000-4000-8000-{n:012d}")


# Tags dédiés — distincts du seed realestate (0xB1/0xB2/0xB3).
T_BUILDING, T_UNIT, T_LISTING = 0xBA, 0xBC, 0x6C


def _pt(lng: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


# ── 6 biens à louer (mix résidentiel + commercial) ──────────────────────────
DEALS = [
    {
        "n": 1,
        "building_type": "residential_tower",
        "unit_type": "apartment",
        "name_en": "Marina Gate Tower",
        "name_ar": "برج بوابة المارينا",
        "name_fr": "Tour Marina Gate",
        "title_en": "Furnished 1BR — Marina Gate",
        "title_ar": "شقة غرفة نوم مفروشة — بوابة المارينا",
        "title_fr": "1 chambre meublé — Marina Gate",
        "monthly": Decimal("9500.00"),
        "annual": Decimal("114000.00"),
        "area": Decimal("78.00"),
        "beds": 1,
        "baths": 1,
        "furnished": True,
        "parking": 1,
        "district": "Dubai Marina",
        "emirate": "DXB",
        "lng": 55.1380,
        "lat": 25.0805,
        "developer": "Select Group",
        "year": 2019,
        "featured": True,
        "urgent": False,
        "img": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
    },
    {
        "n": 2,
        "building_type": "residential_tower",
        "unit_type": "apartment",
        "name_en": "Burj Vista",
        "name_ar": "برج فيستا",
        "name_fr": "Burj Vista",
        "title_en": "2BR with Burj Khalifa View — Downtown",
        "title_ar": "شقة غرفتين بإطلالة برج خليفة — وسط المدينة",
        "title_fr": "2 chambres vue Burj Khalifa — Downtown",
        "monthly": Decimal("16500.00"),
        "annual": Decimal("198000.00"),
        "area": Decimal("125.00"),
        "beds": 2,
        "baths": 2,
        "furnished": False,
        "parking": 1,
        "district": "Downtown Dubai",
        "emirate": "DXB",
        "lng": 55.2744,
        "lat": 25.1972,
        "developer": "Emaar",
        "year": 2017,
        "featured": True,
        "urgent": True,
        "img": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
    },
    {
        "n": 3,
        "building_type": "villa_compound",
        "unit_type": "villa",
        "name_en": "Jumeirah Park Villas",
        "name_ar": "فلل جميرا بارك",
        "name_fr": "Villas Jumeirah Park",
        "title_en": "4BR Family Villa — Jumeirah Park",
        "title_ar": "فيلا عائلية 4 غرف — جميرا بارك",
        "title_fr": "Villa familiale 4 chambres — Jumeirah Park",
        "monthly": Decimal("22000.00"),
        "annual": Decimal("264000.00"),
        "area": Decimal("340.00"),
        "beds": 4,
        "baths": 4,
        "furnished": False,
        "parking": 2,
        "district": "Jumeirah Park",
        "emirate": "DXB",
        "lng": 55.1530,
        "lat": 25.0470,
        "developer": "Nakheel",
        "year": 2015,
        "featured": True,
        "urgent": False,
        "img": "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80",
    },
    {
        "n": 4,
        "building_type": "residential_tower",
        "unit_type": "studio",
        "name_en": "JVC Residence",
        "name_ar": "مساكن قرية جميرا الدائرية",
        "name_fr": "Résidence JVC",
        "title_en": "Cozy Studio — Jumeirah Village Circle",
        "title_ar": "استوديو مريح — قرية جميرا الدائرية",
        "title_fr": "Studio cosy — Jumeirah Village Circle",
        "monthly": Decimal("4200.00"),
        "annual": Decimal("50400.00"),
        "area": Decimal("42.00"),
        "beds": 0,
        "baths": 1,
        "furnished": True,
        "parking": 1,
        "district": "Jumeirah Village Circle",
        "emirate": "DXB",
        "lng": 55.2080,
        "lat": 25.0590,
        "developer": "Nakheel",
        "year": 2020,
        "featured": False,
        "urgent": False,
        "img": "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80",
    },
    {
        "n": 5,
        "building_type": "mixed_use",
        "unit_type": "office",
        "name_en": "One Central",
        "name_ar": "ون سنترال",
        "name_fr": "One Central",
        "title_en": "Grade-A Office — DWTC One Central",
        "title_ar": "مكتب درجة أولى — ون سنترال",
        "title_fr": "Bureau Grade A — One Central",
        "monthly": Decimal("38000.00"),
        "annual": Decimal("456000.00"),
        "area": Decimal("260.00"),
        "beds": None,
        "baths": 2,
        "furnished": False,
        "parking": 4,
        "district": "Trade Centre",
        "emirate": "DXB",
        "lng": 55.2796,
        "lat": 25.2235,
        "developer": "DWTC",
        "year": 2021,
        "featured": False,
        "urgent": True,
        "img": "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80",
    },
    {
        "n": 6,
        "building_type": "residential_tower",
        "unit_type": "apartment",
        "name_en": "Corniche Tower",
        "name_ar": "برج الكورنيش",
        "name_fr": "Tour Corniche",
        "title_en": "3BR Sea View Apartment — Abu Dhabi Corniche",
        "title_ar": "شقة 3 غرف بإطلالة بحرية — كورنيش أبوظبي",
        "title_fr": "Appartement 3 chambres vue mer — Corniche",
        "monthly": Decimal("12500.00"),
        "annual": Decimal("150000.00"),
        "area": Decimal("160.00"),
        "beds": 3,
        "baths": 3,
        "furnished": False,
        "parking": 2,
        "district": "Corniche",
        "emirate": "AUH",
        "lng": 54.3548,
        "lat": 24.4764,
        "developer": "Aldar",
        "year": 2018,
        "featured": False,
        "urgent": False,
        "img": "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=1200&q=80",
    },
]


def _slug(d: dict) -> str:
    out = []
    for ch in d["title_en"].lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in " -—_":
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return f"{slug.strip('-')}-{d['n']}"


async def seed(session: AsyncSession) -> None:
    company_id = (
        await session.execute(select(Company.id).where(Company.slug == COMPANY_SLUG))
    ).scalar_one_or_none()
    if company_id is None:
        raise SystemExit(f"Société '{COMPANY_SLUG}' introuvable.")

    await session.execute(
        text("SELECT set_config('app.current_company_id', :cid, false)"),
        {"cid": str(company_id)},
    )

    now = datetime.now(UTC)
    created = 0

    for d in DEALS:
        b_id = _uid(T_BUILDING, d["n"])
        u_id = _uid(T_UNIT, d["n"])
        l_id = _uid(T_LISTING, d["n"])

        # 1) Bâtiment.
        building = (
            await session.execute(select(Building).where(Building.id == b_id))
        ).scalar_one_or_none()
        if building is None:
            session.add(
                Building(
                    id=b_id,
                    company_id=company_id,
                    reference=f"BLD-LOC-{d['n']:04d}",
                    building_type=d["building_type"],
                    name_en=d["name_en"],
                    name_ar=d["name_ar"],
                    name_fr=d["name_fr"],
                    district=d["district"],
                    emirate=d["emirate"],
                    location=_pt(d["lng"], d["lat"]),
                    year_built=d["year"],
                    developer=d["developer"],
                    status="operational",
                    amenities=["pool", "gym", "security"],
                    images=[d["img"]],
                )
            )
            created += 1

        # 2) Unité.
        unit = (await session.execute(select(Unit).where(Unit.id == u_id))).scalar_one_or_none()
        if unit is None:
            session.add(
                Unit(
                    id=u_id,
                    company_id=company_id,
                    building_id=b_id,
                    unit_number=f"{d['n']}0{d['n']}",
                    unit_type=d["unit_type"],
                    status="vacant",
                    area_sqm=d["area"],
                    bedrooms=d["beds"],
                    bathrooms=d["baths"],
                    furnished=d["furnished"],
                    parking_spaces=d["parking"],
                    list_rent_aed=d["annual"],
                    images=[d["img"]],
                )
            )

        # 3) Annonce de location PUBLIÉE (slug requis pour la vitrine).
        listing = (
            await session.execute(select(RentalListing).where(RentalListing.id == l_id))
        ).scalar_one_or_none()
        if listing is None:
            session.add(
                RentalListing(
                    id=l_id,
                    company_id=company_id,
                    reference=f"LEAS-2026-92{d['n']:04d}",
                    unit_id=u_id,
                    title_en=d["title_en"],
                    title_ar=d["title_ar"],
                    title_fr=d["title_fr"],
                    monthly_rent=d["monthly"],
                    annual_rent=d["annual"],
                    status="published",
                    available_from=date(2026, 7, 1),
                    published_at=now,
                    slug=_slug(d),
                    is_featured=d["featured"],
                    is_urgent=d["urgent"],
                )
            )

    await session.commit()
    print(f"✅ Seed Location : {created} bâtiments/biens créés pour '{COMPANY_SLUG}'.")
    print(f"   Société : {company_id}")
    total = (
        (
            await session.execute(
                select(RentalListing).where(
                    RentalListing.company_id == company_id,
                    RentalListing.status == "published",
                )
            )
        )
        .scalars()
        .all()
    )
    print(f"   Annonces de location publiées au total : {len(total)}")


async def main() -> None:
    async with async_session_maker() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
