"""Service vitrine publique.

- **Helpers purs** (sans DB) : `slugify`.
- **Résolution tenant** : `get_public_company_id` (slug env → company_id) + pose
  manuelle du GUC RLS (la RLS reste active sans JWT).
- **Lecture catalogue** : `list_public_listings` (UNION logique sale+rent publiées,
  JOIN units/buildings ou mandate/properties pour les caractéristiques), mappées
  vers une sortie PUBLIQUE (aucun champ interne/financier sensible).
- **Capture lead** : `capture_public_lead` (réutilise find_or_create_client + CRMLead).

Loi 1 : tout est filtré par company_id ET la RLS est active (GUC posé). Loi 3
(affichage) : conversion sqm→sqft et formatage des montants se font côté frontend.
"""

from __future__ import annotations

import re
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.references import commit_with_reference_retry
from app.core.storage import _presigned_sync
from app.models.branch import Branch
from app.models.building import Building
from app.models.company import Company
from app.models.crm import CRMLead
from app.models.unit import Unit
from app.models.user import User
from app.routers.crm import service as crm_service
from app.routers.leasing.models import RentalListing
from app.routers.marketing.service import find_or_create_client
from app.routers.public_site import search as meili
from app.routers.sales.models import SaleListing, SaleMandate

# GUC tenant — identique au pattern inbox/webhook.py (pose manuelle hors middleware).
_SET_TENANT = text("SELECT set_config('app.current_company_id', :cid, false)")


# ─────────────────────────────────────────────────────────────────────────
# Helper pur — slugify (aligné sur la migration 0038)
# ─────────────────────────────────────────────────────────────────────────

_TRANSLIT = {
    "à": "a",
    "â": "a",
    "ä": "a",
    "á": "a",
    "ã": "a",
    "å": "a",
    "ç": "c",
    "è": "e",
    "é": "e",
    "ê": "e",
    "ë": "e",
    "ì": "i",
    "í": "i",
    "î": "i",
    "ï": "i",
    "ñ": "n",
    "ò": "o",
    "ó": "o",
    "ô": "o",
    "ö": "o",
    "õ": "o",
    "ù": "u",
    "ú": "u",
    "û": "u",
    "ü": "u",
    "ý": "y",
    "ÿ": "y",
}


def slugify(value: str) -> str:
    """Kebab-case ASCII (translittération latine basique). Pur, testable."""
    text_v = (value or "").strip().lower()
    for src, dst in _TRANSLIT.items():
        text_v = text_v.replace(src, dst)
    text_v = re.sub(r"[^a-z0-9]+", "-", text_v)
    text_v = re.sub(r"-{2,}", "-", text_v).strip("-")
    return text_v


# ─────────────────────────────────────────────────────────────────────────
# Résolution tenant + GUC RLS manuel
# ─────────────────────────────────────────────────────────────────────────


async def get_public_company_id(db: AsyncSession) -> uuid.UUID | None:
    """Résout `settings.PUBLIC_SITE_COMPANY_SLUG` → company_id.

    Retourne None si le slug est vide/non configuré ou introuvable (fail-safe :
    la vitrine reste vide, aucune fuite, jamais 500).
    """
    slug = (settings.PUBLIC_SITE_COMPANY_SLUG or "").strip()
    if not slug:
        return None
    row = (
        await db.execute(
            select(Company.id).where(
                Company.slug == slug,
                Company.deleted_at.is_(None),
                Company.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    return row


async def set_tenant_guc(db: AsyncSession, company_id: uuid.UUID) -> None:
    """Pose le GUC RLS pour la société publique (hors middleware tenant).

    Niveau session (is_local=false) → survit aux commits, comme get_db_session.
    """
    await db.execute(_SET_TENANT, {"cid": str(company_id)})


# ─────────────────────────────────────────────────────────────────────────
# Photos — presigned MinIO (best-effort, jamais bloquant)
# ─────────────────────────────────────────────────────────────────────────


def _presign_all(raw_images: Any) -> list[str]:
    """Convertit une liste de clés objet MinIO en URLs signées temporaires.

    Tolère les entrées déjà-URL (http…) et ignore silencieusement les erreurs de
    signature (MinIO indisponible) pour ne jamais faire échouer la vitrine.
    """
    out: list[str] = []
    if not isinstance(raw_images, list):
        return out
    ttl = settings.PUBLIC_PHOTO_URL_TTL_S
    for item in raw_images:
        if not isinstance(item, str) or not item:
            continue
        if item.startswith("http://") or item.startswith("https://"):
            out.append(item)
            continue
        try:
            out.append(_presigned_sync(item, ttl))
        except Exception:  # noqa: S112  signature best-effort
            continue
    return out


def _pick_title(ar: str | None, en: str | None, fr: str | None) -> str | None:
    return en or ar or fr


# ─────────────────────────────────────────────────────────────────────────
# Mapping vers sortie PUBLIQUE (champs marketing uniquement)
# ─────────────────────────────────────────────────────────────────────────


def _map_rental(
    listing: RentalListing,
    unit: Unit | None,
    building: Building | None,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    images: list[str] = []
    if unit is not None and isinstance(unit.images, list):
        images.extend(unit.images)
    if building is not None and isinstance(building.images, list):
        images.extend(building.images)
    photos = _presign_all(images)
    return {
        "slug": listing.slug,
        "deal": "rent",
        "title": _pick_title(listing.title_ar, listing.title_en, listing.title_fr),
        "title_ar": listing.title_ar,
        "title_en": listing.title_en,
        "title_fr": listing.title_fr,
        "price": listing.annual_rent or (listing.monthly_rent * 12),
        "price_period": "year",
        "currency": "AED",
        "unit_type": unit.unit_type if unit else None,
        "bedrooms": unit.bedrooms if unit else None,
        "bathrooms": unit.bathrooms if unit else None,
        "area_sqm": unit.area_sqm if unit else None,
        "parking_spaces": unit.parking_spaces if unit else None,
        "furnished": unit.furnished if unit else None,
        "city": (building.district if building else None),
        "district": building.district if building else None,
        "emirate": building.emirate if building else None,
        "building_name": _pick_title(building.name_ar, building.name_en, building.name_fr)
        if building
        else None,
        "year_built": building.year_built if building else None,
        "developer": building.developer if building else None,
        "reference": listing.reference,
        "photos": photos,
        "cover_photo": photos[0] if photos else None,
        "is_featured": listing.is_featured,
        "is_urgent": listing.is_urgent,
        "lat": float(lat) if lat is not None else None,
        "lng": float(lng) if lng is not None else None,
    }


def _map_sale(
    listing: SaleListing,
    prop: Any | None,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    images = prop.images if (prop is not None and isinstance(prop.images, list)) else []
    photos = _presign_all(images)
    return {
        "slug": listing.slug,
        "deal": "sale",
        "title": _pick_title(listing.title_ar, listing.title_en, listing.title_fr)
        or (_pick_title(prop.title_ar, prop.title_en, prop.title_fr) if prop else None),
        "title_ar": listing.title_ar or (prop.title_ar if prop else None),
        "title_en": listing.title_en or (prop.title_en if prop else None),
        "title_fr": listing.title_fr or (prop.title_fr if prop else None),
        "price": listing.list_price,
        "price_period": None,
        "currency": "AED",
        "unit_type": prop.type if prop else None,
        "bedrooms": prop.bedrooms if prop else None,
        "bathrooms": prop.bathrooms if prop else None,
        "area_sqm": prop.area_sqm if prop else None,
        "parking_spaces": prop.parking_spaces if prop else None,
        "furnished": prop.furnished if prop else None,
        "city": prop.city if prop else None,
        "district": prop.district if prop else None,
        "emirate": None,
        "building_name": None,
        "year_built": prop.year_built if prop else None,
        "developer": prop.developer if prop else None,
        "reference": listing.reference,
        "photos": photos,
        "cover_photo": photos[0] if photos else None,
        "is_featured": listing.is_featured,
        "is_urgent": listing.is_urgent,
        "lat": float(lat) if lat is not None else None,
        "lng": float(lng) if lng is not None else None,
    }


# ─────────────────────────────────────────────────────────────────────────
# Lecture catalogue
# ─────────────────────────────────────────────────────────────────────────


def _matches_filters(
    row: dict,
    *,
    city: str | None,
    emirate: str | None,
    unit_type: str | None,
    price_min: Decimal | None,
    price_max: Decimal | None,
    bedrooms: int | None,
) -> bool:
    if city and (row.get("city") or "").lower() != city.lower():
        return False
    if emirate and (row.get("emirate") or "").upper() != emirate.upper():
        return False
    if unit_type and (row.get("unit_type") or "") != unit_type:
        return False
    price = row.get("price")
    if price_min is not None and (price is None or price < price_min):
        return False
    if price_max is not None and (price is None or price > price_max):
        return False
    if bedrooms is not None and (row.get("bedrooms") or 0) < bedrooms:
        return False
    return True


async def _load_published_rentals(db: AsyncSession, company_id: uuid.UUID) -> list[dict]:
    rows = (
        await db.execute(
            select(
                RentalListing,
                Unit,
                Building,
                func.ST_Y(Building.location).label("lat"),
                func.ST_X(Building.location).label("lng"),
            )
            .outerjoin(Unit, Unit.id == RentalListing.unit_id)
            .outerjoin(Building, Building.id == Unit.building_id)
            .where(
                RentalListing.company_id == company_id,
                RentalListing.deleted_at.is_(None),
                RentalListing.status == "published",
                RentalListing.slug.is_not(None),
            )
        )
    ).all()
    return [
        _map_rental(listing, unit, building, lat, lng)
        for (listing, unit, building, lat, lng) in rows
    ]


async def _load_published_sales(db: AsyncSession, company_id: uuid.UUID) -> list[dict]:
    # Import local : évite un cycle d'import au chargement du module.
    from app.models.property import Property

    rows = (
        await db.execute(
            select(
                SaleListing,
                Property,
                func.ST_Y(Property.location).label("lat"),
                func.ST_X(Property.location).label("lng"),
            )
            .join(SaleMandate, SaleMandate.id == SaleListing.mandate_id)
            .outerjoin(Property, Property.id == SaleMandate.property_id)
            .where(
                SaleListing.company_id == company_id,
                SaleListing.deleted_at.is_(None),
                SaleListing.status == "published",
                SaleListing.slug.is_not(None),
            )
        )
    ).all()
    return [_map_sale(listing, prop, lat, lng) for (listing, prop, lat, lng) in rows]


def _sort_rows(rows: list[dict], sort: str | None) -> list[dict]:
    # Featured/urgent d'abord, puis tri demandé. Tri stable.
    if sort == "price_asc":
        rows.sort(key=lambda r: r.get("price") or Decimal(0))
    elif sort == "price_desc":
        rows.sort(key=lambda r: r.get("price") or Decimal(0), reverse=True)
    # featured/urgent toujours remontés en tête (priorité marketing).
    rows.sort(key=lambda r: (not r.get("is_featured"), not r.get("is_urgent")))
    return rows


async def list_public_listings(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    deal: str | None = None,  # "sale" | "rent" | None
    city: str | None = None,
    emirate: str | None = None,
    unit_type: str | None = None,
    price_min: Decimal | None = None,
    price_max: Decimal | None = None,
    bedrooms: int | None = None,
    sort: str | None = None,
    page: int = 1,
    limit: int = 12,
) -> tuple[list[dict], int]:
    """UNION logique sale_listings + rental_listings PUBLIÉES → sortie publique."""
    rows: list[dict] = []
    if deal in (None, "rent"):
        rows.extend(await _load_published_rentals(db, company_id))
    if deal in (None, "sale"):
        rows.extend(await _load_published_sales(db, company_id))

    rows = [
        r
        for r in rows
        if r.get("slug")
        and _matches_filters(
            r,
            city=city,
            emirate=emirate,
            unit_type=unit_type,
            price_min=price_min,
            price_max=price_max,
            bedrooms=bedrooms,
        )
    ]
    rows = _sort_rows(rows, sort)
    total = len(rows)
    start = (page - 1) * limit
    return rows[start : start + limit], total


async def _public_agent(db: AsyncSession, company_id: uuid.UUID) -> dict | None:
    """Contact public dérivé de l'agence (succursale active) — jamais un agent privé."""
    company_name = (
        await db.execute(select(Company.name).where(Company.id == company_id))
    ).scalar_one_or_none()
    branch = (
        await db.execute(
            select(Branch)
            .where(
                Branch.company_id == company_id,
                Branch.is_active.is_(True),
            )
            .order_by(Branch.created_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    phone = branch.phone if branch else None
    return {
        "name": company_name,
        "phone": phone,
        "whatsapp": phone,
        "email": branch.email if branch else None,
    }


async def get_public_listing(db: AsyncSession, company_id: uuid.UUID, slug: str) -> dict | None:
    """Détail d'une annonce publiée par slug (vente ou location). None si absente."""
    # Location d'abord.
    from app.models.property import Property

    rental = (
        await db.execute(
            select(RentalListing, Unit, Building)
            .outerjoin(Unit, Unit.id == RentalListing.unit_id)
            .outerjoin(Building, Building.id == Unit.building_id)
            .where(
                RentalListing.company_id == company_id,
                RentalListing.deleted_at.is_(None),
                RentalListing.status == "published",
                RentalListing.slug == slug,
            )
            .limit(1)
        )
    ).first()
    if rental is not None:
        listing, unit, building = rental
        out = _map_rental(listing, unit, building)
        out["agent"] = await _public_agent(db, company_id)
        return out

    sale = (
        await db.execute(
            select(SaleListing, Property)
            .join(SaleMandate, SaleMandate.id == SaleListing.mandate_id)
            .outerjoin(Property, Property.id == SaleMandate.property_id)
            .where(
                SaleListing.company_id == company_id,
                SaleListing.deleted_at.is_(None),
                SaleListing.status == "published",
                SaleListing.slug == slug,
            )
            .limit(1)
        )
    ).first()
    if sale is not None:
        listing, prop = sale
        out = _map_sale(listing, prop)
        out["agent"] = await _public_agent(db, company_id)
        return out
    return None


async def public_stats(db: AsyncSession, company_id: uuid.UUID) -> dict:
    """Compteurs home : annonces publiées (vente / location / total)."""
    sale_count = (
        await db.execute(
            select(func.count(SaleListing.id)).where(
                SaleListing.company_id == company_id,
                SaleListing.deleted_at.is_(None),
                SaleListing.status == "published",
            )
        )
    ).scalar_one() or 0
    rent_count = (
        await db.execute(
            select(func.count(RentalListing.id)).where(
                RentalListing.company_id == company_id,
                RentalListing.deleted_at.is_(None),
                RentalListing.status == "published",
            )
        )
    ).scalar_one() or 0
    return {
        "sale_count": int(sale_count),
        "rent_count": int(rent_count),
        "total_count": int(sale_count) + int(rent_count),
    }


# ─────────────────────────────────────────────────────────────────────────
# Capture de lead public
# ─────────────────────────────────────────────────────────────────────────


async def capture_public_lead(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    contact: dict,
    listing_slug: str | None,
    message: str | None,
) -> CRMLead:
    """Crée (ou dédup) un Client puis un CRMLead `source=public:{slug|site}`.

    Réutilise `find_or_create_client` (dédup email/phone) et le scoring CRM.
    Catégorie 'realestate'. NE lève jamais sur input valide (le router protège
    l'enveloppe). Idempotent au niveau du client (dédup).
    """
    client, _created = await find_or_create_client(
        db,
        company_id,
        name=contact.get("name"),
        email=contact.get("email"),
        phone=contact.get("phone"),
        source_type="public_website",
    )

    source = f"public:{listing_slug}" if listing_slug else "public:site"

    score = crm_service.calculate_score(
        budget=None,
        golden_visa_eligible=False,
        property_type=None,
        response_rate=0.0,
        last_contact_at=None,
    )

    def _build(reference: str) -> CRMLead:
        return CRMLead(
            company_id=company_id,
            reference=reference,
            client_id=client.id,
            status="new",
            source=source[:50],
            category="realestate",
            score=score,
            notes=message,
            preferred_location=None,
        )

    lead = await commit_with_reference_retry(
        db,
        lambda: crm_service._next_reference(db, company_id),
        _build,
    )
    return lead


# ─────────────────────────────────────────────────────────────────────────
# Profils agents publics
# ─────────────────────────────────────────────────────────────────────────

# Rôles exposés publiquement comme « agents » de l'agence.
_PUBLIC_AGENT_ROLES = ("agent", "manager")


def _agent_to_dict(u: User) -> dict:
    """Sortie PUBLIQUE d'un agent — aucun champ sensible (pas de hash, mfa, etc.)."""
    return {
        "slug": slugify(f"{u.full_name}-{str(u.id)[:6]}"),
        "name": u.full_name,
        "title": u.title,
        "photo_url": u.photo_url,
        "phone": u.phone,
        "whatsapp": u.whatsapp or u.phone,
        "email": u.email,
        "bio": u.bio,
    }


async def list_public_agents(db: AsyncSession, company_id: uuid.UUID) -> list[dict]:
    """Agents actifs de l'agence, exposés publiquement (champs non sensibles)."""
    rows = (
        (
            await db.execute(
                select(User)
                .where(
                    User.company_id == company_id,
                    User.role.in_(_PUBLIC_AGENT_ROLES),
                    User.is_active.is_(True),
                    User.status == "active",
                    User.deleted_at.is_(None),
                )
                .order_by(User.full_name.asc())
            )
        )
        .scalars()
        .all()
    )
    return [_agent_to_dict(u) for u in rows]


async def get_public_agent(db: AsyncSession, company_id: uuid.UUID, slug: str) -> dict | None:
    """Profil d'un agent résolu par slug (slugify(nom-id6))."""
    for agent in await list_public_agents(db, company_id):
        if agent["slug"] == slug:
            return agent
    return None


# ─────────────────────────────────────────────────────────────────────────
# Recherche full-text (Meilisearch + fallback DB)
# ─────────────────────────────────────────────────────────────────────────


def _db_substring_search(rows: list[dict], q: str, limit: int) -> list[dict]:
    """Repli : filtrage substring (sans typo-tolérance) sur titre/ville/quartier."""
    ql = q.lower()

    def _hay(r: dict) -> str:
        parts = (r.get("title"), r.get("city"), r.get("district"), r.get("unit_type"))
        return " ".join(p for p in parts if p).lower()

    hits = [r for r in rows if ql in _hay(r)]
    return hits[:limit]


async def search_listings(
    db: AsyncSession,
    company_id: uuid.UUID,
    q: str,
    *,
    deal: str | None = None,
    limit: int = 12,
) -> tuple[list[dict], int]:
    """Recherche par mot-clé : Meilisearch d'abord (typo-tolérant), sinon DB.

    Best-effort : toute erreur Meili (indispo, index manquant) → repli DB substring.
    L'isolation est garantie (filtre `company_id` côté Meili ET DB).
    """
    try:
        hits = await meili.search(company_id, q, deal=deal, limit=limit)
        if hits:
            return hits, len(hits)
    except Exception:  # noqa: BLE001, S110  recherche best-effort → repli DB
        pass
    # 0 hit (index vide/non encore peuplé) OU erreur Meili → repli DB substring :
    # garantit que la recherche n'affiche jamais un catalogue « vide à tort ».
    rows, _ = await list_public_listings(db, company_id, deal=deal, page=1, limit=200)
    hits = _db_substring_search(rows, q, limit)
    return hits, len(hits)


async def reindex_public_listings(db: AsyncSession, company_id: uuid.UUID) -> int:
    """(Ré)indexe dans Meili toutes les annonces publiées de la société."""
    rows, _ = await list_public_listings(db, company_id, page=1, limit=1000)
    return await meili.reindex(company_id, rows)
