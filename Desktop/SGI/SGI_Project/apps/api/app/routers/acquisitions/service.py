"""Service Acquisitions.

- **Helpers purs** (sans DB) : génération de référence, machines à états
  (offre + mandat), score de rapprochement bien/mandat.
- **Fonctions DB** : filtrées par company_id (Loi 1) + moteur de matching PostGIS
  (Loi 2 — distances en geography/mètres).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from geoalchemy2.elements import WKTElement
from sqlalchemy import Select, and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property import Property
from app.routers.acquisitions.models import BuyerMandate, PurchaseOffer

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs (sans DB)
# ─────────────────────────────────────────────────────────────────────────

# Statuts d'une offre d'achat.
OFFER_STATUSES: frozenset[str] = frozenset(
    {"draft", "submitted", "accepted", "rejected", "withdrawn"}
)
OFFER_TERMINAL: frozenset[str] = frozenset({"accepted", "rejected", "withdrawn"})

# Statuts d'un mandat d'achat.
MANDATE_STATUSES: frozenset[str] = frozenset({"active", "fulfilled", "expired", "cancelled"})
MANDATE_TERMINAL: frozenset[str] = frozenset({"fulfilled", "expired", "cancelled"})

_OFFER_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"submitted"}),
    "submitted": frozenset({"accepted", "rejected", "withdrawn"}),
    # accepted / rejected / withdrawn = terminaux (aucune sortie).
}

_MANDATE_TRANSITIONS: dict[str, frozenset[str]] = {
    "active": frozenset({"fulfilled", "expired", "cancelled"}),
    # fulfilled / expired / cancelled = terminaux (aucune sortie).
}


def generate_reference(year: int, sequence: int) -> str:
    """Référence triable : `ACQ-2026-000042`."""
    return f"ACQ-{year:04d}-{sequence:06d}"


def is_valid_offer_transition(current: str, target: str) -> bool:
    """Machine à états d'une offre : draft→submitted ; submitted→{accepted,
    rejected,withdrawn} ; les trois derniers sont terminaux."""
    if current not in OFFER_STATUSES or target not in OFFER_STATUSES or current == target:
        return False
    return target in _OFFER_TRANSITIONS.get(current, frozenset())


def is_valid_mandate_transition(current: str, target: str) -> bool:
    """Machine à états d'un mandat : active→{fulfilled,expired,cancelled} ;
    les trois derniers sont terminaux."""
    if current not in MANDATE_STATUSES or target not in MANDATE_STATUSES or current == target:
        return False
    return target in _MANDATE_TRANSITIONS.get(current, frozenset())


def _to_float(value: Decimal | float | int | None) -> float | None:
    """Conversion robuste vers float (None si absent)."""
    if value is None:
        return None
    return float(value)


def match_score(
    budget_min: Decimal | float | int | None,
    budget_max: Decimal | float | int | None,
    property_type: str | None,
    bedrooms_min: int | None,
    prop_price: Decimal | float | int | None,
    prop_type: str | None,
    prop_bedrooms: int | None,
) -> int:
    """Score d'adéquation bien/mandat sur 0–100 (pur, sans DB).

    Barème (somme bornée à [0, 100]) :
      - Prix (60 pts) : dans la fourchette [budget_min, budget_max] → 60 pts.
        Hors fourchette → pénalité dégressive linéaire selon l'écart relatif au
        bord franchi (écart de 100 % du budget de référence → 0 pt). Si aucun
        budget n'est exprimé, le critère prix est neutre → 60 pts (non bloquant).
        Un prix manquant côté bien neutralise aussi le critère (60 pts).
      - Type (25 pts) : correspondance exacte du type de bien → 25 pts.
        Si le mandat n'exige pas de type → neutre → 25 pts. Sinon 0.
      - Chambres (15 pts) : bien.bedrooms >= bedrooms_min demandé → 15 pts.
        Si le mandat n'exige pas de minimum → neutre → 15 pts. Sinon 0.

    Numériquement robuste : jamais de division par zéro (garde sur les bornes).
    """
    bmin = _to_float(budget_min)
    bmax = _to_float(budget_max)
    price = _to_float(prop_price)

    # ── Composante prix (60 pts) ──────────────────────────────────────────
    price_score = 60.0
    if price is not None and (bmin is not None or bmax is not None):
        if (bmin is None or price >= bmin) and (bmax is None or price <= bmax):
            # Dans la fourchette.
            price_score = 60.0
        else:
            # Hors fourchette : écart au bord franchi, normalisé par un budget
            # de référence strictement positif → pénalité linéaire jusqu'à 0.
            if bmax is not None and price > bmax:
                gap = price - bmax
                ref = bmax
            else:  # price < bmin (bmin forcément défini ici)
                assert bmin is not None
                gap = bmin - price
                ref = bmin
            ref = ref if ref > 0 else 1.0  # garde anti-division par zéro
            ratio = gap / ref
            price_score = 60.0 * max(0.0, 1.0 - ratio)

    # ── Composante type (25 pts) ──────────────────────────────────────────
    if property_type is None:
        type_score = 25.0
    elif prop_type is not None and prop_type == property_type:
        type_score = 25.0
    else:
        type_score = 0.0

    # ── Composante chambres (15 pts) ──────────────────────────────────────
    if bedrooms_min is None:
        bed_score = 15.0
    elif prop_bedrooms is not None and prop_bedrooms >= bedrooms_min:
        bed_score = 15.0
    else:
        bed_score = 0.0

    total = price_score + type_score + bed_score
    return int(round(max(0.0, min(100.0, total))))


# ─────────────────────────────────────────────────────────────────────────
# Fonctions DB — filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


def _make_point(lat: float | None, lng: float | None) -> WKTElement | None:
    """Convertit lat/lng en WKTElement PostGIS POINT (SRID 4326)."""
    if lat is None or lng is None:
        return None
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


async def next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    """Prochaine référence `ACQ-YYYY-NNNNNN` pour le tenant (séquence par société
    et par année — comptée sur les mandats ET les offres pour rester globale au
    module et triable)."""
    year = datetime.now(UTC).year
    prefix = f"ACQ-{year:04d}-%"
    mandates = (
        await db.execute(
            select(func.count())
            .select_from(BuyerMandate)
            .where(
                BuyerMandate.company_id == company_id,
                BuyerMandate.reference.like(prefix),
            )
        )
    ).scalar_one()
    offers = (
        await db.execute(
            select(func.count())
            .select_from(PurchaseOffer)
            .where(
                PurchaseOffer.company_id == company_id,
                PurchaseOffer.reference.like(prefix),
            )
        )
    ).scalar_one()
    return generate_reference(year, mandates + offers + 1)


# ── Mandats ────────────────────────────────────────────────────────────────


async def create_mandate(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    buyer_client_id: uuid.UUID,
    budget_min: Decimal | None = None,
    budget_max: Decimal | None = None,
    property_type: str | None = None,
    bedrooms_min: int | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    search_radius_m: int | None = None,
    notes: str | None = None,
    signed_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> BuyerMandate:
    mandate = BuyerMandate(
        company_id=company_id,
        reference=await next_reference(db, company_id),
        buyer_client_id=buyer_client_id,
        status="active",
        budget_min=budget_min,
        budget_max=budget_max,
        property_type=property_type,
        bedrooms_min=bedrooms_min,
        preferred_location=_make_point(latitude, longitude),
        search_radius_m=search_radius_m,
        notes=notes,
        signed_at=signed_at,
        expires_at=expires_at,
    )
    db.add(mandate)
    await db.commit()
    await db.refresh(mandate)
    return mandate


async def get_mandate(
    db: AsyncSession, company_id: uuid.UUID, mandate_id: uuid.UUID
) -> BuyerMandate | None:
    result = await db.execute(
        select(BuyerMandate).where(
            BuyerMandate.id == mandate_id,
            BuyerMandate.company_id == company_id,
            BuyerMandate.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_mandates(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
) -> tuple[list[BuyerMandate], int]:
    base = select(BuyerMandate).where(
        BuyerMandate.company_id == company_id,
        BuyerMandate.deleted_at.is_(None),
    )
    if status:
        base = base.where(BuyerMandate.status == status)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(BuyerMandate.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_mandate(
    db: AsyncSession,
    company_id: uuid.UUID,
    mandate_id: uuid.UUID,
    new_status: str,
) -> BuyerMandate | None:
    mandate = await get_mandate(db, company_id, mandate_id)
    if mandate is None:
        return None
    if not is_valid_mandate_transition(mandate.status, new_status):
        raise ValueError(f"invalid_transition:{mandate.status}->{new_status}")
    mandate.status = new_status
    mandate.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(mandate)
    return mandate


# ── Offres ──────────────────────────────────────────────────────────────────


async def create_offer(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    mandate_id: uuid.UUID,
    property_id: uuid.UUID,
    amount: Decimal,
    notes: str | None = None,
) -> PurchaseOffer:
    offer = PurchaseOffer(
        company_id=company_id,
        reference=await next_reference(db, company_id),
        mandate_id=mandate_id,
        property_id=property_id,
        amount=amount,
        status="draft",
        notes=notes,
    )
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return offer


async def get_offer(
    db: AsyncSession, company_id: uuid.UUID, offer_id: uuid.UUID
) -> PurchaseOffer | None:
    result = await db.execute(
        select(PurchaseOffer).where(
            PurchaseOffer.id == offer_id,
            PurchaseOffer.company_id == company_id,
            PurchaseOffer.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_offers(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    mandate_id: uuid.UUID | None = None,
    status: str | None = None,
) -> tuple[list[PurchaseOffer], int]:
    base = select(PurchaseOffer).where(
        PurchaseOffer.company_id == company_id,
        PurchaseOffer.deleted_at.is_(None),
    )
    if mandate_id:
        base = base.where(PurchaseOffer.mandate_id == mandate_id)
    if status:
        base = base.where(PurchaseOffer.status == status)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(PurchaseOffer.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_offer(
    db: AsyncSession,
    company_id: uuid.UUID,
    offer_id: uuid.UUID,
    new_status: str,
) -> PurchaseOffer | None:
    offer = await get_offer(db, company_id, offer_id)
    if offer is None:
        return None
    if not is_valid_offer_transition(offer.status, new_status):
        raise ValueError(f"invalid_transition:{offer.status}->{new_status}")
    now = datetime.now(UTC)
    offer.status = new_status
    if new_status == "submitted" and offer.submitted_at is None:
        offer.submitted_at = now
    if new_status in ("accepted", "rejected") and offer.decided_at is None:
        offer.decided_at = now
    offer.updated_at = now
    await db.commit()
    await db.refresh(offer)
    return offer


# ── Moteur de rapprochement PostGIS (Loi 2) ─────────────────────────────────


async def find_matches(
    db: AsyncSession,
    company_id: uuid.UUID,
    mandate: BuyerMandate,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Rapproche les biens disponibles du tenant avec le mandat.

    Filtres SQL (Loi 1 company_id + soft delete) :
      - prix dans la fourchette [budget_min, budget_max] si exprimée ;
      - type de bien si demandé ;
      - proximité géographique `ST_DWithin(::geography)` si le mandat porte un
        point + un rayon (Loi 2 : distances en mètres, jamais en degrés).

    Retourne une liste de dicts (colonnes du bien + `dist_m` + `match_score`),
    triée par `match_score` décroissant puis distance croissante.
    """
    filters: list[Any] = [
        Property.company_id == company_id,
        Property.deleted_at.is_(None),
    ]
    if mandate.budget_min is not None:
        filters.append(Property.price >= mandate.budget_min)
    if mandate.budget_max is not None:
        filters.append(Property.price <= mandate.budget_max)
    if mandate.property_type is not None:
        filters.append(Property.type == mandate.property_type)

    # Distance géographique : seulement si point + rayon disponibles. On lit les
    # coordonnées du mandat via ST_X/ST_Y pour rester en bind params (pas
    # d'interpolation de chaîne dans le SQL — Loi 2).
    has_geo = mandate.preferred_location is not None and mandate.search_radius_m is not None
    dist_select = None
    if has_geo:
        coords = (
            await db.execute(
                select(
                    func.ST_Y(BuyerMandate.preferred_location),
                    func.ST_X(BuyerMandate.preferred_location),
                ).where(
                    BuyerMandate.id == mandate.id,
                    BuyerMandate.company_id == company_id,
                )
            )
        ).first()
        if coords is not None and coords[0] is not None and coords[1] is not None:
            m_lat, m_lng = float(coords[0]), float(coords[1])
            geo_point = "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography"
            dwithin = text(f"ST_DWithin(location::geography, {geo_point}, :radius_m)").bindparams(
                lng=m_lng, lat=m_lat, radius_m=mandate.search_radius_m
            )
            dist_select = text(
                f"ST_Distance(location::geography, {geo_point}) AS dist_m"
            ).bindparams(lng=m_lng, lat=m_lat)
            filters.append(Property.location.isnot(None))
            filters.append(dwithin)

    stmt: Select[Any]
    if dist_select is not None:
        stmt = select(Property, dist_select).where(and_(*filters)).limit(limit)
    else:
        stmt = select(Property).where(and_(*filters)).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    out: list[dict[str, Any]] = []
    for row in rows:
        prop: Property = row[0]
        dist: float | None = float(row[1]) if dist_select is not None else None
        record: dict[str, Any] = {
            col.name: getattr(prop, col.name) for col in prop.__table__.columns
        }
        # Exclure le WKB binaire brut (non sérialisable JSON).
        record["location"] = None
        record["dist_m"] = round(dist, 1) if dist is not None else None
        record["match_score"] = match_score(
            mandate.budget_min,
            mandate.budget_max,
            mandate.property_type,
            mandate.bedrooms_min,
            prop.price,
            prop.type,
            prop.bedrooms,
        )
        out.append(record)

    # Tri final en Python : score décroissant, puis distance croissante.
    out.sort(key=lambda r: (-r["match_score"], r["dist_m"] if r["dist_m"] is not None else 0.0))
    return out
