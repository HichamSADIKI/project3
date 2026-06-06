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
async def test_update_partial_latitude_preserves_longitude(db_session, seed_company: Company):
    """PATCH avec seulement `latitude` ne doit PAS effacer la longitude (bug M1)."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)

    new_lat = 24.453884
    await update_property(db_session, cid, prop.id, PropertyUpdate(latitude=new_lat))

    lat, lng = await _coords(db_session, prop.id)
    assert lat == pytest.approx(new_lat, abs=1e-6)
    # La longitude d'origine doit être conservée — pas remise à NULL.
    assert lng == pytest.approx(DUBAI_LNG, abs=1e-6)


@pytest.mark.asyncio
async def test_update_partial_longitude_preserves_latitude(db_session, seed_company: Company):
    """PATCH avec seulement `longitude` conserve la latitude existante."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)

    new_lng = 54.377344
    await update_property(db_session, cid, prop.id, PropertyUpdate(longitude=new_lng))

    lat, lng = await _coords(db_session, prop.id)
    assert lng == pytest.approx(new_lng, abs=1e-6)
    assert lat == pytest.approx(DUBAI_LAT, abs=1e-6)


@pytest.mark.asyncio
async def test_update_both_coordinates_replaces_point(db_session, seed_company: Company):
    """PATCH avec les deux coordonnées remplace intégralement le point."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)

    await update_property(db_session, cid, prop.id, PropertyUpdate(latitude=24.0, longitude=54.0))

    lat, lng = await _coords(db_session, prop.id)
    assert lat == pytest.approx(24.0, abs=1e-6)
    assert lng == pytest.approx(54.0, abs=1e-6)


@pytest.mark.asyncio
async def test_update_without_coordinates_keeps_location(db_session, seed_company: Company):
    """PATCH d'un autre champ ne touche pas à la localisation."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)

    await update_property(db_session, cid, prop.id, PropertyUpdate(price=Decimal("1600000.00")))

    lat, lng = await _coords(db_session, prop.id)
    assert lat == pytest.approx(DUBAI_LAT, abs=1e-6)
    assert lng == pytest.approx(DUBAI_LNG, abs=1e-6)


@pytest.mark.asyncio
async def test_update_partial_coord_on_property_without_location(db_session, seed_company: Company):
    """Sans localisation préexistante, une seule coordonnée ne crée pas de point partiel."""
    cid = str(seed_company.id)
    prop = await _seed_property(db_session, seed_company.id, None, None)

    await update_property(db_session, cid, prop.id, PropertyUpdate(latitude=DUBAI_LAT))

    lat, lng = await _coords(db_session, prop.id)
    assert lat is None and lng is None


# ── Recherche par rayon (Loi 2 — carte interactive) ──────────────────────────


@pytest.mark.asyncio
async def test_search_by_radius_returns_coordinates(db_session, seed_company: Company):
    """Le résultat carto expose latitude/longitude (décodés du WKB) + dist_m."""
    from .service import search_by_radius

    prop = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)
    results = await search_by_radius(
        db_session, str(seed_company.id), lat=DUBAI_LAT, lng=DUBAI_LNG, radius_m=1000
    )
    hit = next(r for r in results if r["id"] == prop.id)
    assert hit["latitude"] == round(DUBAI_LAT, 6)
    assert hit["longitude"] == round(DUBAI_LNG, 6)
    assert hit["dist_m"] >= 0
    assert hit["location"] is None  # WKB brut exclu de la réponse JSON


@pytest.mark.asyncio
async def test_search_by_radius_excludes_far_and_other_tenant(db_session, seed_company: Company):
    """ST_DWithin exclut les biens hors rayon ; le filtre company_id exclut un
    autre tenant (Loi 1)."""
    from app.models.company import Company as Co

    from .service import search_by_radius

    near = await _seed_property(db_session, seed_company.id, DUBAI_LAT, DUBAI_LNG)
    far = await _seed_property(db_session, seed_company.id, 24.4539, 54.3773)  # Abu Dhabi ~120 km

    other = Co(
        id=uuid.uuid4(),
        name="Other",
        slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db_session.add(other)
    await db_session.commit()
    foreign = await _seed_property(db_session, other.id, DUBAI_LAT, DUBAI_LNG)

    results = await search_by_radius(
        db_session, str(seed_company.id), lat=DUBAI_LAT, lng=DUBAI_LNG, radius_m=5000
    )
    ids = {r["id"] for r in results}
    assert near.id in ids
    assert far.id not in ids  # hors rayon
    assert foreign.id not in ids  # autre tenant (Loi 1)


# ── Import CSV de biens (géolocalisation PostGIS) ────────────────────────────

from httpx import AsyncClient  # noqa: E402

from app.models.user import User  # noqa: E402

from .service import parse_property_rows, search_by_radius  # noqa: E402

_PROP_CSV = (
    "type,price,title_en,city,latitude,longitude\n"
    "apartment,1500000,Marina Flat,Dubai,25.2,55.27\n"
    "villa,5000000,Palm Villa,Dubai,25.11,55.13\n"
)


def test_parse_property_rows_valid_and_invalid() -> None:
    csv_text = (
        "type,price,latitude,longitude\n"
        "apartment,1000000,25.2,55.2\n"  # ok
        "spaceship,1000000,25.2,55.2\n"  # type invalide
        "apartment,-5,25.2,55.2\n"  # prix <= 0
    )
    valid, errors = parse_property_rows(csv_text)
    assert len(valid) == 1
    assert {e["line"] for e in errors} == {3, 4}


def test_parse_property_rows_row_limit() -> None:
    from .service import CSV_IMPORT_MAX_ROWS

    rows = "\n".join("apartment,1000000" for _ in range(CSV_IMPORT_MAX_ROWS + 3))
    valid, errors = parse_property_rows("type,price\n" + rows + "\n")
    assert len(valid) == CSV_IMPORT_MAX_ROWS
    assert any("row_limit_exceeded" in e["error"] for e in errors)


@pytest.mark.asyncio
async def test_import_properties_requires_auth(client: AsyncClient) -> None:
    r = await client.post(
        "/api/v1/properties/import.csv",
        files={"file": ("p.csv", _PROP_CSV.encode(), "text/csv")},
    )
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_import_properties_creates_and_geolocates(
    client: AsyncClient, db_session, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    r = await client.post(
        "/api/v1/properties/import.csv",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("p.csv", _PROP_CSV.encode(), "text/csv")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["created"] == 2 and r.json()["data"]["failed"] == 0
    # Géolocalisation effective : la recherche par rayon (PostGIS) retrouve le bien.
    hits = await search_by_radius(
        db_session, str(admin.company_id), lat=25.2, lng=55.27, radius_m=1000
    )
    titles = {h["title_en"] for h in hits}
    assert "Marina Flat" in titles
    assert all(h["latitude"] is not None for h in hits)


@pytest.mark.asyncio
async def test_import_properties_reports_invalid(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    bad = "type,price\napartment,1000000\nspaceship,1000000\n"
    r = await client.post(
        "/api/v1/properties/import.csv",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("p.csv", bad.encode(), "text/csv")},
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["created"] == 1 and data["failed"] == 1
    assert data["errors"][0]["line"] == 3


@pytest.mark.asyncio
async def test_import_properties_tenant_isolation(
    client: AsyncClient,
    db_session,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : un bien importé par A n'est pas visible par le tenant B."""
    admin, token_a = seed_admin
    company_b, _token_b = second_admin
    csv_text = "type,price,title_en,latitude,longitude\napartment,1234567,IsoFlat,25.2,55.27\n"
    r = await client.post(
        "/api/v1/properties/import.csv",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("p.csv", csv_text.encode(), "text/csv")},
    )
    assert r.json()["data"]["created"] == 1
    hits_b = await search_by_radius(
        db_session, str(company_b.id), lat=25.2, lng=55.27, radius_m=1000
    )
    assert all(h["title_en"] != "IsoFlat" for h in hits_b)
