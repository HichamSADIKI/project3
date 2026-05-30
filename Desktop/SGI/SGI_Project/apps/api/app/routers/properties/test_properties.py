"""Tests Properties — focalisés sur la gestion PostGIS de la localisation.

⚠️ Tests d'intégration : requièrent PostgreSQL+PostGIS via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/properties/test_properties.py`.
"""
import uuid
from decimal import Decimal

import pytest
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select

from app.models.company import Company
from app.models.property import Property

from .schemas import PropertyUpdate
from .service import update_property

DUBAI_LAT = 25.197197
DUBAI_LNG = 55.274376


async def _coords(db, property_id: uuid.UUID) -> tuple[float | None, float | None]:
    """Retourne (lat, lng) lus depuis PostGIS, ou (None, None) si location NULL."""
    row = (
        await db.execute(
            select(func.ST_Y(Property.location), func.ST_X(Property.location)).where(
                Property.id == property_id
            )
        )
    ).first()
    return (row[0], row[1]) if row else (None, None)


async def _seed_property(
    db, company_id: uuid.UUID, lat: float | None, lng: float | None
) -> Property:
    """Insère une propriété avec référence unique (contrainte `reference` globale)."""
    location = (
        WKTElement(f"POINT({lng} {lat})", srid=4326)
        if lat is not None and lng is not None
        else None
    )
    prop = Property(
        company_id=company_id,
        reference=f"TST-{uuid.uuid4().hex[:12]}",
        type="apartment",
        price=Decimal("1500000.00"),
        status="available",
        location=location,
    )
    db.add(prop)
    await db.commit()
    await db.refresh(prop)
    return prop


@pytest.mark.asyncio
async def test_update_partial_latitude_preserves_longitude(
    db_session, seed_company: Company
):
    """PATCH avec seulement `latitude` ne doit PAS effacer la longitude (bug M1)."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)

    new_lat = 24.453884
    await update_property(
        db_session, cid, prop.id, PropertyUpdate(latitude=new_lat)
    )

    lat, lng = await _coords(db_session, prop.id)
    assert lat == pytest.approx(new_lat, abs=1e-6)
    # La longitude d'origine doit être conservée — pas remise à NULL.
    assert lng == pytest.approx(DUBAI_LNG, abs=1e-6)


@pytest.mark.asyncio
async def test_update_partial_longitude_preserves_latitude(
    db_session, seed_company: Company
):
    """PATCH avec seulement `longitude` conserve la latitude existante."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)

    new_lng = 54.377344
    await update_property(
        db_session, cid, prop.id, PropertyUpdate(longitude=new_lng)
    )

    lat, lng = await _coords(db_session, prop.id)
    assert lng == pytest.approx(new_lng, abs=1e-6)
    assert lat == pytest.approx(DUBAI_LAT, abs=1e-6)


@pytest.mark.asyncio
async def test_update_both_coordinates_replaces_point(
    db_session, seed_company: Company
):
    """PATCH avec les deux coordonnées remplace intégralement le point."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)

    await update_property(
        db_session, cid, prop.id, PropertyUpdate(latitude=24.0, longitude=54.0)
    )

    lat, lng = await _coords(db_session, prop.id)
    assert lat == pytest.approx(24.0, abs=1e-6)
    assert lng == pytest.approx(54.0, abs=1e-6)


@pytest.mark.asyncio
async def test_update_without_coordinates_keeps_location(
    db_session, seed_company: Company
):
    """PATCH d'un autre champ ne touche pas à la localisation."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)

    await update_property(
        db_session, cid, prop.id, PropertyUpdate(price=Decimal("1600000.00"))
    )

    lat, lng = await _coords(db_session, prop.id)
    assert lat == pytest.approx(DUBAI_LAT, abs=1e-6)
    assert lng == pytest.approx(DUBAI_LNG, abs=1e-6)


@pytest.mark.asyncio
async def test_update_partial_coord_on_property_without_location(
    db_session, seed_company: Company
):
    """Sans localisation préexistante, une seule coordonnée ne crée pas de point partiel."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, None, None)

    await update_property(
        db_session, cid, prop.id, PropertyUpdate(latitude=DUBAI_LAT)
    )

    lat, lng = await _coords(db_session, prop.id)
    assert lat is None and lng is None
