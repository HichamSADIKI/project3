"""Service Properties — toutes les fonctions filtrent par company_id."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from geoalchemy2.elements import WKTElement
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property import Property

from .schemas import PropertyCreate, PropertyUpdate

# ---------------------------------------------------------------------------
# Helpers internes
# ---------------------------------------------------------------------------


def _gen_reference(seq: int) -> str:
    """Génère une référence de type DXB-YYYY-NNNN."""
    year = datetime.now(UTC).year
    return f"DXB-{year}-{seq:04d}"


def _make_point(lat: float | None, lng: float | None) -> WKTElement | None:
    """Convertit lat/lng en WKTElement PostGIS POINT (SRID 4326)."""
    if lat is None or lng is None:
        return None
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


async def list_properties(
    db: AsyncSession,
    company_id: str,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    type_: str | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    bedrooms: int | None = None,
    city: str | None = None,
    q: str | None = None,
) -> tuple[list[Property], int]:
    """Retourne (items, total) filtrés par company_id."""
    filters = [
        Property.company_id == uuid.UUID(company_id),
        Property.deleted_at.is_(None),
    ]
    if status:
        filters.append(Property.status == status)
    if type_:
        filters.append(Property.type == type_)
    if min_price is not None:
        filters.append(Property.price >= min_price)
    if max_price is not None:
        filters.append(Property.price <= max_price)
    if bedrooms is not None:
        filters.append(Property.bedrooms == bedrooms)
    if city:
        filters.append(Property.city.ilike(f"%{city}%"))
    if q:
        filters.append(
            or_(
                Property.title_en.ilike(f"%{q}%"),
                Property.title_ar.ilike(f"%{q}%"),
                Property.reference.ilike(f"%{q}%"),
                Property.district.ilike(f"%{q}%"),
            )
        )

    total_q = await db.execute(select(func.count()).select_from(Property).where(and_(*filters)))
    total = total_q.scalar_one()

    offset = (page - 1) * limit
    result = await db.execute(
        select(Property)
        .where(and_(*filters))
        .order_by(Property.is_featured.desc(), Property.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_property(
    db: AsyncSession,
    company_id: str,
    property_id: uuid.UUID,
) -> Property | None:
    """Récupère un bien par ID, filtré par company_id et non supprimé."""
    result = await db.execute(
        select(Property).where(
            Property.id == property_id,
            Property.company_id == uuid.UUID(company_id),
            Property.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_property(
    db: AsyncSession,
    company_id: str,
    data: PropertyCreate,
) -> Property:
    """Crée un bien immobilier avec référence auto-générée."""
    seq_result = await db.execute(
        select(func.count())
        .select_from(Property)
        .where(Property.company_id == uuid.UUID(company_id))
    )
    seq = (seq_result.scalar_one() or 0) + 1

    prop = Property(
        company_id=uuid.UUID(company_id),
        reference=_gen_reference(seq),
        type=data.type,
        title_en=data.title_en,
        title_ar=data.title_ar,
        title_fr=data.title_fr,
        description_en=data.description_en,
        description_ar=data.description_ar,
        description_fr=data.description_fr,
        price=data.price,
        area_sqm=data.area_sqm,
        bedrooms=data.bedrooms,
        bathrooms=data.bathrooms,
        status=data.status,
        location=_make_point(data.latitude, data.longitude),
        address_en=data.address_en,
        address_ar=data.address_ar,
        district=data.district,
        city=data.city,
        developer=data.developer,
        year_built=data.year_built,
        floor=data.floor,
        total_floors=data.total_floors,
        furnished=data.furnished,
        parking_spaces=data.parking_spaces,
        amenities=data.amenities,
        is_featured=data.is_featured,
        agent_id=data.agent_id,
    )
    db.add(prop)
    await db.commit()
    await db.refresh(prop)
    return prop


async def update_property(
    db: AsyncSession,
    company_id: str,
    property_id: uuid.UUID,
    data: PropertyUpdate,
) -> Property | None:
    """Met à jour un bien existant. Retourne None si introuvable."""
    prop = await get_property(db, company_id, property_id)
    if not prop:
        return None

    update_data = data.model_dump(exclude_none=True)

    # Traitement spécial pour les coordonnées → conversion en PostGIS
    lat = update_data.pop("latitude", None)
    lng = update_data.pop("longitude", None)
    if lat is not None or lng is not None:
        # Si un seul des deux est fourni, on complète l'autre depuis la
        # localisation existante en base (ST_Y = lat, ST_X = lng) pour ne pas
        # effacer la géolocalisation déjà géocodée.
        if lat is None or lng is None:
            existing = (
                await db.execute(
                    select(
                        func.ST_Y(Property.location),
                        func.ST_X(Property.location),
                    ).where(
                        Property.id == property_id,
                        Property.company_id == uuid.UUID(company_id),
                    )
                )
            ).first()
            if existing is not None:
                ex_lat, ex_lng = existing
                if lat is None:
                    lat = ex_lat
                if lng is None:
                    lng = ex_lng
        # _make_point renvoie None si une coordonnée manque encore (aucune
        # localisation préexistante) → on ne touche pas à prop.location.
        point = _make_point(lat, lng)
        if point is not None:
            prop.location = point

    for key, value in update_data.items():
        setattr(prop, key, value)

    await db.commit()
    await db.refresh(prop)
    return prop


async def delete_property(
    db: AsyncSession,
    company_id: str,
    property_id: uuid.UUID,
) -> bool:
    """Soft delete — positionne deleted_at. Retourne False si introuvable."""
    prop = await get_property(db, company_id, property_id)
    if not prop:
        return False
    prop.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


# ---------------------------------------------------------------------------
# Recherche géospatiale
# ---------------------------------------------------------------------------


async def search_by_radius(
    db: AsyncSession,
    company_id: str,
    lat: float,
    lng: float,
    radius_m: float,
    type_: str | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    bedrooms: int | None = None,
    limit: int = 20,
) -> list[dict]:
    """
    Recherche géospatiale par rayon.
    Retourne une liste de dicts incluant dist_m (distance en mètres).
    Utilise ST_DWithin + ST_Distance sur geography (unité = mètres).
    """
    # Point de référence en bind params (jamais d'interpolation de chaîne dans le
    # SQL) — conforme au template PostGIS de CLAUDE.md (Loi 2).
    geo_point = "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography"
    dwithin = text(f"ST_DWithin(location::geography, {geo_point}, :radius_m)").bindparams(
        lng=lng, lat=lat, radius_m=radius_m
    )
    dist_m = text(f"ST_Distance(location::geography, {geo_point}) AS dist_m").bindparams(
        lng=lng, lat=lat
    )

    filters = [
        Property.company_id == uuid.UUID(company_id),
        Property.deleted_at.is_(None),
        Property.location.isnot(None),
        dwithin,
    ]
    if type_:
        filters.append(Property.type == type_)
    if min_price is not None:
        filters.append(Property.price >= min_price)
    if max_price is not None:
        filters.append(Property.price <= max_price)
    if bedrooms is not None:
        filters.append(Property.bedrooms == bedrooms)

    # Coordonnées décodées pour l'affichage carto (Leaflet) — le WKB brut de
    # `location` n'est pas sérialisable JSON. ST_X = longitude, ST_Y = latitude.
    lat_col = text("ST_Y(location::geometry) AS lat")
    lng_col = text("ST_X(location::geometry) AS lng")
    stmt = (
        select(Property, dist_m, lat_col, lng_col)
        .where(and_(*filters))
        .order_by(text("dist_m"))
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.all()

    out: list[dict] = []
    for row in rows:
        prop: Property = row[0]
        dist: float = row[1]
        lat: float | None = row[2]
        lng: float | None = row[3]
        record: dict = {col.name: getattr(prop, col.name) for col in prop.__table__.columns}
        # Exclure le WKB binaire brut (non-sérialisable JSON), exposer lat/lng.
        record["location"] = None
        record["dist_m"] = round(dist, 1)
        record["latitude"] = round(lat, 6) if lat is not None else None
        record["longitude"] = round(lng, 6) if lng is not None else None
        out.append(record)

    return out
