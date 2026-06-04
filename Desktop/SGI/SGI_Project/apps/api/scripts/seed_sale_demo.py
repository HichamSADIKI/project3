"""Seed démo — Vente (module `sales`) pour la vitrine publique.

Crée un jeu de biens à VENDRE cohérent Dubai / Abu Dhabi (mix commercial +
résidentiel) pour la société `infinity-uae`, prêt à tester de bout en bout :

    properties (legacy)  →  sale_mandates  →  sale_listings (status='published')

Les annonces publiées apparaissent dans l'écran **Vente** du back-office (admin
de la société `infinity-uae`) ET sur la **vitrine publique** (`/api/v1/public`).

Idempotent : UUID figés → relancer ne duplique rien. Tout porte `company_id`
(Loi 1). Images = URLs externes (tolérées telles quelles par la vitrine).

Lancer dans le conteneur api :
    docker compose exec api uv run python -m scripts.seed_sale_demo
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from geoalchemy2.elements import WKTElement
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.client import Client
from app.models.company import Company
from app.models.property import Property
from app.routers.sales.models import SaleListing, SaleMandate

COMPANY_SLUG = "infinity-uae"


def _uid(tag: int, n: int) -> uuid.UUID:
    """UUID stable et lisible pour l'idempotence."""
    return uuid.UUID(f"{tag:08x}-0000-4000-8000-{n:012d}")


# Tag propriété 0xDA dédié (évite la collision avec le seed realestate qui occupe 0xD1).
T_SELLER, T_PROP, T_MANDATE, T_LISTING = 0x5E, 0xDA, 0x5A, 0x51


def _pt(lng: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


# ── Jeu de données : 6 biens à vendre (3 commerciaux + 3 résidentiels) ──────
# img : photo de couverture (Unsplash, libre) — la vitrine accepte les URLs http.
DEALS = [
    {
        "n": 1,
        "type": "office",
        "title_en": "Premium Office Floor — Business Bay",
        "title_ar": "طابق مكتبي فاخر — الخليج التجاري",
        "title_fr": "Plateau de bureaux premium — Business Bay",
        "price": Decimal("8500000.00"),
        "area": Decimal("520.00"),
        "beds": None,
        "baths": 2,
        "city": "Dubai",
        "district": "Business Bay",
        "lng": 55.2654,
        "lat": 25.1872,
        "developer": "DAMAC",
        "year": 2021,
        "parking": 8,
        "featured": True,
        "urgent": False,
        "img": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
    },
    {
        "n": 2,
        "type": "retail",
        "title_en": "Retail Showroom — Sheikh Zayed Road",
        "title_ar": "صالة عرض تجارية — شارع الشيخ زايد",
        "title_fr": "Showroom commercial — Sheikh Zayed Road",
        "price": Decimal("12000000.00"),
        "area": Decimal("680.00"),
        "beds": None,
        "baths": 2,
        "city": "Dubai",
        "district": "Trade Centre",
        "lng": 55.2796,
        "lat": 25.2235,
        "developer": "Emaar",
        "year": 2019,
        "parking": 12,
        "featured": True,
        "urgent": True,
        "img": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
    },
    {
        "n": 3,
        "type": "commercial",
        "title_en": "Mixed-Use Commercial Building — Al Reem Island",
        "title_ar": "مبنى تجاري متعدد الاستخدامات — جزيرة الريم",
        "title_fr": "Immeuble commercial mixte — Al Reem Island",
        "price": Decimal("45000000.00"),
        "area": Decimal("3200.00"),
        "beds": None,
        "baths": 6,
        "city": "Abu Dhabi",
        "district": "Al Reem Island",
        "lng": 54.4012,
        "lat": 24.4992,
        "developer": "Aldar",
        "year": 2020,
        "parking": 40,
        "featured": False,
        "urgent": False,
        "img": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80",
    },
    {
        "n": 4,
        "type": "apartment",
        "title_en": "3BR Apartment — Dubai Marina",
        "title_ar": "شقة 3 غرف — مرسى دبي",
        "title_fr": "Appartement 3 chambres — Dubai Marina",
        "price": Decimal("3200000.00"),
        "area": Decimal("185.00"),
        "beds": 3,
        "baths": 3,
        "city": "Dubai",
        "district": "Dubai Marina",
        "lng": 55.1380,
        "lat": 25.0805,
        "developer": "Select Group",
        "year": 2018,
        "parking": 2,
        "featured": True,
        "urgent": False,
        "img": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
    },
    {
        "n": 5,
        "type": "villa",
        "title_en": "Luxury 5BR Villa — Palm Jumeirah",
        "title_ar": "فيلا فاخرة 5 غرف — نخلة جميرا",
        "title_fr": "Villa de luxe 5 chambres — Palm Jumeirah",
        "price": Decimal("28000000.00"),
        "area": Decimal("740.00"),
        "beds": 5,
        "baths": 6,
        "city": "Dubai",
        "district": "Palm Jumeirah",
        "lng": 55.1390,
        "lat": 25.1124,
        "developer": "Nakheel",
        "year": 2017,
        "parking": 4,
        "featured": True,
        "urgent": True,
        "img": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
    },
    {
        "n": 6,
        "type": "apartment",
        "title_en": "2BR Apartment — Downtown Dubai",
        "title_ar": "شقة غرفتين — وسط مدينة دبي",
        "title_fr": "Appartement 2 chambres — Downtown Dubai",
        "price": Decimal("2400000.00"),
        "area": Decimal("120.00"),
        "beds": 2,
        "baths": 2,
        "city": "Dubai",
        "district": "Downtown Dubai",
        "lng": 55.2744,
        "lat": 25.1972,
        "developer": "Emaar",
        "year": 2016,
        "parking": 1,
        "featured": False,
        "urgent": False,
        "img": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
    },
]


def _slug(d: dict) -> str:
    base = d["title_en"].lower()
    out = []
    for ch in base:
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

    # GUC tenant (par sécurité ; le rôle privilégié bypass déjà la RLS).
    await session.execute(
        text("SELECT set_config('app.current_company_id', :cid, false)"),
        {"cid": str(company_id)},
    )

    now = datetime.now(UTC)

    # 1) Un vendeur (party client) partagé.
    seller_id = _uid(T_SELLER, 1)
    seller = (
        await session.execute(select(Client).where(Client.id == seller_id))
    ).scalar_one_or_none()
    if seller is None:
        session.add(
            Client(
                id=seller_id,
                company_id=company_id,
                type="individual",
                first_name="Khalid",
                last_name="Al Maktoum (démo vente)",
                email="seller.demo@infinity-uae.com",
                phone="+971500000099",
                nationality="AE",
            )
        )
        await session.flush()

    created = 0
    for d in DEALS:
        prop_id = _uid(T_PROP, d["n"])
        mandate_id = _uid(T_MANDATE, d["n"])
        listing_id = _uid(T_LISTING, d["n"])

        # 2) Propriété (table legacy `properties`).
        prop = (
            await session.execute(select(Property).where(Property.id == prop_id))
        ).scalar_one_or_none()
        if prop is None:
            session.add(
                Property(
                    id=prop_id,
                    company_id=company_id,
                    reference=f"PROP-VTE-{d['n']:04d}",
                    type=d["type"],
                    title_en=d["title_en"],
                    title_ar=d["title_ar"],
                    title_fr=d["title_fr"],
                    description_en=f"{d['title_en']} — bien de démonstration à la vente.",
                    price=d["price"],
                    area_sqm=d["area"],
                    bedrooms=d["beds"],
                    bathrooms=d["baths"],
                    status="available",
                    location=_pt(d["lng"], d["lat"]),
                    district=d["district"],
                    city=d["city"],
                    developer=d["developer"],
                    year_built=d["year"],
                    parking_spaces=d["parking"],
                    furnished=False,
                    amenities=["central_ac", "security", "parking"],
                    images=[d["img"]],
                    is_featured=d["featured"],
                )
            )
            created += 1

        # 3) Mandat de vente.
        mandate = (
            await session.execute(select(SaleMandate).where(SaleMandate.id == mandate_id))
        ).scalar_one_or_none()
        if mandate is None:
            session.add(
                SaleMandate(
                    id=mandate_id,
                    company_id=company_id,
                    reference=f"SALE-2026-90{d['n']:04d}",
                    seller_client_id=seller_id,
                    property_id=prop_id,
                    mandate_type="exclusive",
                    commission_rate=Decimal("2.00"),
                    asking_price=d["price"],
                    status="active",
                    signed_at=now - timedelta(days=10),
                    expires_at=now + timedelta(days=180),
                )
            )

        # 4) Annonce PUBLIÉE (slug requis pour la vitrine).
        listing = (
            await session.execute(select(SaleListing).where(SaleListing.id == listing_id))
        ).scalar_one_or_none()
        if listing is None:
            session.add(
                SaleListing(
                    id=listing_id,
                    company_id=company_id,
                    reference=f"SALE-2026-91{d['n']:04d}",
                    mandate_id=mandate_id,
                    title_en=d["title_en"],
                    title_ar=d["title_ar"],
                    title_fr=d["title_fr"],
                    list_price=d["price"],
                    status="published",
                    published_at=now,
                    slug=_slug(d),
                    is_featured=d["featured"],
                    is_urgent=d["urgent"],
                )
            )

    await session.commit()
    print(f"✅ Seed Vente : {created} biens créés (ou déjà présents) pour '{COMPANY_SLUG}'.")
    print(f"   Société : {company_id}")
    total = (
        (
            await session.execute(
                select(SaleListing).where(
                    SaleListing.company_id == company_id,
                    SaleListing.status == "published",
                )
            )
        )
        .scalars()
        .all()
    )
    print(f"   Annonces de vente publiées au total : {len(total)}")


async def main() -> None:
    async with async_session_maker() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
