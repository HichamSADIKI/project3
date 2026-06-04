"""Seed démo — annonces PUBLIÉES pour la vitrine publique (infinity-uae).

Crée des `rental_listings` + `sale_listings` au statut `published` rattachées aux
unités/propriétés déjà semées par `seed_realestate`, plus un profil agent public
sur l'admin. Idempotent (clé = slug). N'EST PAS lié à RLS (rôle privilégié).

Lancer : docker compose exec -e PYTHONPATH=/app api uv run python scripts/seed_public_demo.py
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.client import Client
from app.models.company import Company
from app.models.property import Property
from app.models.unit import Unit
from app.models.user import User
from app.routers.leasing.models import RentalListing
from app.routers.sales.models import SaleListing, SaleMandate

DEMO_SLUG = "infinity-uae"

# Photos de démonstration (passthrough http dans _presign_all).
IMG = [
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
]


def _slugify(s: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-").replace("--", "-")


async def main() -> None:
    async with async_session_maker() as s:
        company = (
            await s.execute(select(Company).where(Company.slug == DEMO_SLUG))
        ).scalar_one_or_none()
        if company is None:
            print(f"⚠️ société '{DEMO_SLUG}' absente — lancer `make seed` d'abord.")
            return
        cid = company.id
        print(f"société {DEMO_SLUG} = {cid}")

        units = list(
            (await s.execute(select(Unit).where(Unit.company_id == cid).order_by(Unit.id)))
            .scalars()
            .all()
        )
        created = 0

        # ── Photos sur les unités (si vide) ───────────────────────────────────
        for u in units:
            if not isinstance(u.images, list) or not u.images:
                u.images = IMG

        # ── Annonces de LOCATION publiées ─────────────────────────────────────
        rent_specs = [
            ("Spacieux 2 chambres — Marina vue mer", 0, True, False),
            ("Studio lumineux 1 chambre — Downtown", 1, False, True),
            ("Penthouse 4 chambres — vue panoramique", 3, True, False),
            ("Appartement 3 chambres familial", 2, False, False),
        ]
        for i, (title, uidx, feat, urg) in enumerate(rent_specs, start=1):
            if uidx >= len(units):
                continue
            unit = units[uidx]
            slug = _slugify(f"{title}-{i}")
            exists = (
                await s.execute(
                    select(RentalListing).where(
                        RentalListing.company_id == cid, RentalListing.slug == slug
                    )
                )
            ).scalar_one_or_none()
            if exists is not None:
                continue
            rent = unit.list_rent_aed or Decimal("120000.00")
            s.add(
                RentalListing(
                    id=uuid.uuid4(),
                    company_id=cid,
                    reference=f"RL-2026-9000{i:02d}",
                    unit_id=unit.id,
                    title_en=title,
                    title_fr=title,
                    title_ar=title,
                    monthly_rent=(rent / Decimal(12)).quantize(Decimal("0.01")),
                    annual_rent=rent,
                    status="published",
                    available_from=date(2026, 7, 1),
                    published_at=datetime.now(UTC),
                    slug=slug,
                    is_featured=feat,
                    is_urgent=urg,
                )
            )
            created += 1

        # ── Annonces de VENTE publiées (mandate → property) ───────────────────
        owner = (
            (await s.execute(select(Client).where(Client.company_id == cid).order_by(Client.id)))
            .scalars()
            .first()
        )
        props = list(
            (
                await s.execute(
                    select(Property).where(Property.company_id == cid).order_by(Property.id)
                )
            )
            .scalars()
            .all()
        )
        sale_specs = [
            ("Villa contemporaine 5 chambres — Palm Jumeirah", Decimal("8500000.00"), True),
            ("Appartement de luxe 3 chambres — Business Bay", Decimal("3200000.00"), False),
        ]
        if owner is not None:
            for i, (title, price, feat) in enumerate(sale_specs, start=1):
                slug = _slugify(f"{title}-{i}")
                exists = (
                    await s.execute(
                        select(SaleListing).where(
                            SaleListing.company_id == cid, SaleListing.slug == slug
                        )
                    )
                ).scalar_one_or_none()
                if exists is not None:
                    continue
                prop = props[(i - 1) % len(props)] if props else None
                mandate = SaleMandate(
                    id=uuid.uuid4(),
                    company_id=cid,
                    reference=f"SM-2026-9000{i:02d}",
                    seller_client_id=owner.id,
                    property_id=prop.id if prop is not None else None,
                    mandate_type="exclusive",
                    asking_price=price,
                    status="active",
                )
                s.add(mandate)
                await s.flush()
                s.add(
                    SaleListing(
                        id=uuid.uuid4(),
                        company_id=cid,
                        reference=f"SL-2026-9000{i:02d}",
                        mandate_id=mandate.id,
                        list_price=price,
                        status="published",
                        published_at=datetime.now(UTC),
                        slug=slug,
                        is_featured=feat,
                        is_urgent=False,
                    )
                )
                created += 1

        # ── Profil agent public sur l'admin ───────────────────────────────────
        admin = (
            await s.execute(
                select(User).where(User.company_id == cid, User.email == "admin@infinity-uae.com")
            )
        ).scalar_one_or_none()
        if admin is not None:
            if not getattr(admin, "phone", None):
                admin.phone = "+971 4 123 4567"
            if not getattr(admin, "whatsapp", None):
                admin.whatsapp = "+971501234567"
            if not getattr(admin, "title", None):
                admin.title = "Senior Property Consultant"
            if not getattr(admin, "bio", None):
                admin.bio = "15 ans d'expérience sur le marché immobilier de Dubaï."
            if not getattr(admin, "photo_url", None):
                admin.photo_url = (
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80"
                )

        await s.commit()
        print(f"✓ {created} annonce(s) publiée(s) créée(s).")


if __name__ == "__main__":
    asyncio.run(main())
