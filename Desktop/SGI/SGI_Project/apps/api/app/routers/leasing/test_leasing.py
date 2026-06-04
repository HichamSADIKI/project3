"""Tests Leasing / Location — helpers purs + intégration HTTP.

- Helpers purs (sans DB) : generate_reference, machines à états annonce/candidature.
- Intégration HTTP (requiert PostgreSQL — `docker compose exec api uv run pytest`) :
  flux listing→application→screening→approved→converted, isolation multi-tenant
  (Loi 1), 404 anti-BOLA, 409 transition invalide.
"""

import uuid as _uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.building import Building
from app.models.client import Client
from app.models.company import Company
from app.models.contract import Contract
from app.models.property import Property
from app.models.rental import Rental
from app.models.unit import Unit
from app.models.user import User
from app.routers.leasing import service
from app.routers.leasing.models import RentalApplication, RentalListing

# ── Helpers purs : generate_reference ─────────────────────────────────────────


def test_generate_reference() -> None:
    assert service.generate_reference(2026, 42) == "LEAS-2026-000042"
    assert service.generate_reference(2026, 1) == "LEAS-2026-000001"
    # Triable lexicographiquement.
    assert service.generate_reference(2026, 5) < service.generate_reference(2026, 50)


class TestBuildSlug:
    _UID = _uuid.UUID("0123456789abcdef0123456789abcdef")  # hex[:6] = "012345"

    def test_basic_kebab_and_suffix(self) -> None:
        slug = service.build_slug(
            "Cozy Apartment Marina", fallback="LEAS-2026-000001", uniq=self._UID
        )
        assert slug == "cozy-apartment-marina-012345"

    def test_suffix_is_uuid_hex(self) -> None:
        # le suffixe garantit l'unicité par société sans round-trip DB
        slug = service.build_slug("X", fallback="ref", uniq=self._UID)
        assert slug.endswith(f"-{self._UID.hex[:6]}")

    def test_picks_first_non_empty_title(self) -> None:
        slug = service.build_slug(None, "", "Second Title", fallback="ref", uniq=self._UID)
        assert slug == "second-title-012345"

    def test_falls_back_when_all_titles_empty(self) -> None:
        slug = service.build_slug(None, None, fallback="LEAS-2026-000007", uniq=self._UID)
        assert slug == "leas-2026-000007-012345"

    def test_strips_non_ascii_and_collapses_separators(self) -> None:
        slug = service.build_slug("  Été — Villa / Mer  ", fallback="ref", uniq=self._UID)
        assert slug == "t-villa-mer-012345"

    def test_punctuation_only_base_yields_annonce(self) -> None:
        slug = service.build_slug("!!!", fallback="@@@", uniq=self._UID)
        assert slug == "annonce-012345"


# ── Helpers purs : machine à états des annonces ───────────────────────────────


class TestListingTransitions:
    @pytest.mark.parametrize(
        "current,target",
        [
            ("draft", "published"),
            ("draft", "withdrawn"),
            ("published", "reserved"),
            ("published", "leased"),
            ("published", "withdrawn"),
            ("reserved", "leased"),
            ("reserved", "published"),
            ("reserved", "withdrawn"),
            ("withdrawn", "published"),
        ],
    )
    def test_valid(self, current: str, target: str) -> None:
        assert service.is_valid_listing_transition(current, target) is True

    @pytest.mark.parametrize(
        "current,target",
        [
            # leased = terminal
            ("leased", "published"),
            ("leased", "withdrawn"),
            ("leased", "reserved"),
            # sauts interdits
            ("draft", "reserved"),
            ("draft", "leased"),
            ("withdrawn", "draft"),
            ("reserved", "draft"),
            # self-transition
            ("draft", "draft"),
            ("published", "published"),
            # statut inconnu
            ("zzz", "published"),
            ("draft", "zzz"),
        ],
    )
    def test_invalid(self, current: str, target: str) -> None:
        assert service.is_valid_listing_transition(current, target) is False


# ── Helpers purs : machine à états des candidatures ───────────────────────────


class TestApplicationTransitions:
    @pytest.mark.parametrize(
        "current,target",
        [
            ("submitted", "screening"),
            ("submitted", "rejected"),
            ("screening", "approved"),
            ("screening", "rejected"),
            ("approved", "converted"),
        ],
    )
    def test_valid(self, current: str, target: str) -> None:
        assert service.is_valid_application_transition(current, target) is True

    @pytest.mark.parametrize(
        "current,target",
        [
            # terminaux
            ("converted", "approved"),
            ("converted", "rejected"),
            ("rejected", "screening"),
            ("rejected", "approved"),
            # sauts interdits
            ("submitted", "approved"),
            ("submitted", "converted"),
            ("screening", "converted"),
            ("approved", "rejected"),
            # self-transition
            ("submitted", "submitted"),
            ("approved", "approved"),
            # statut inconnu
            ("zzz", "screening"),
            ("submitted", "zzz"),
        ],
    )
    def test_invalid(self, current: str, target: str) -> None:
        assert service.is_valid_application_transition(current, target) is False


# ── Intégration HTTP ──────────────────────────────────────────────────────────


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_listing(
    client: AsyncClient,
    token: str,
    monthly_rent: str = "12000.00",
    unit_id: str | None = None,
) -> str:
    payload: dict[str, object] = {"monthly_rent": monthly_rent, "title_en": "2BR Marina"}
    if unit_id is not None:
        payload["unit_id"] = unit_id
    resp = await client.post("/api/v1/leasing/listings", headers=_auth(token), json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]["id"]


async def _create_client(db_session: AsyncSession, company_id: _uuid.UUID) -> _uuid.UUID:
    """Crée un client candidat directement (évite le couplage au module clients)."""
    c = Client(
        id=_uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name="Cand",
        last_name="Idate",
        email=f"cand-{_uuid.uuid4().hex[:8]}@example.com",
    )
    db_session.add(c)
    await db_session.commit()
    return c.id


async def _seed_unit(
    db_session: AsyncSession, company_id: _uuid.UUID, *, with_property: bool = True
) -> tuple[_uuid.UUID, _uuid.UUID | None]:
    """Crée Building + Unit (+ Property liée via legacy_property_id si demandé).

    Retourne (unit_id, property_id|None) — le pont unité→bien requis par la
    conversion en bail effectif.
    """
    property_id: _uuid.UUID | None = None
    if with_property:
        prop = Property(
            id=_uuid.uuid4(),
            company_id=company_id,
            reference=f"PROP-{_uuid.uuid4().hex[:10]}",
            type="apartment",
            price=Decimal("1200000"),
            status="available",
        )
        db_session.add(prop)
        property_id = prop.id
    building = Building(
        id=_uuid.uuid4(),
        company_id=company_id,
        reference=f"BLD-{_uuid.uuid4().hex[:10]}",
        building_type="residential_tower",
    )
    db_session.add(building)
    await db_session.flush()
    unit = Unit(
        id=_uuid.uuid4(),
        company_id=company_id,
        building_id=building.id,
        unit_number="101",
        unit_type="apartment",
        legacy_property_id=property_id,
    )
    db_session.add(unit)
    await db_session.commit()
    return unit.id, property_id


async def _seed_application(
    db_session: AsyncSession,
    company_id: _uuid.UUID,
    *,
    unit_id: _uuid.UUID | None = None,
    offered_rent: str | None = "11500.00",
    listing_rent: str = "12000.00",
    status: str = "approved",
) -> tuple[_uuid.UUID, _uuid.UUID]:
    """Seed annonce (∈ tenant, unit_id optionnel) + candidature au statut voulu.

    Retourne (application_id, applicant_client_id).
    """
    client_id = await _create_client(db_session, company_id)
    listing = RentalListing(
        id=_uuid.uuid4(),
        company_id=company_id,
        reference=f"LEAS-{_uuid.uuid4().hex[:6]}",
        unit_id=unit_id,
        monthly_rent=Decimal(listing_rent),
        status="published",
    )
    db_session.add(listing)
    await db_session.flush()
    appn = RentalApplication(
        id=_uuid.uuid4(),
        company_id=company_id,
        reference=f"APP-{_uuid.uuid4().hex[:6]}",
        listing_id=listing.id,
        applicant_client_id=client_id,
        offered_rent=Decimal(offered_rent) if offered_rent else None,
        status=status,
    )
    db_session.add(appn)
    await db_session.commit()
    return appn.id, client_id


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/leasing/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "leasing"


async def test_listing_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/leasing/listings")
    # Endpoint protégé : 403 (rôle absent) ou 401 (tenant manquant).
    assert resp.status_code in (401, 403)


async def test_create_listing_sets_reference(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    listing_id = await _create_listing(client, token)
    resp = await client.get(f"/api/v1/leasing/listings/{listing_id}", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["reference"].startswith("LEAS-")
    assert data["status"] == "draft"


async def test_full_flow_listing_to_converted(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    unit_id, _property_id = await _seed_unit(db_session, admin.company_id)
    listing_id = await _create_listing(client, token, unit_id=str(unit_id))

    # draft → published
    r = await client.post(
        f"/api/v1/leasing/listings/{listing_id}/transition",
        headers=_auth(token),
        json={"status": "published"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "published"
    assert r.json()["data"]["published_at"] is not None

    # candidature
    applicant_id = await _create_client(db_session, admin.company_id)
    r = await client.post(
        "/api/v1/leasing/applications",
        headers=_auth(token),
        json={
            "listing_id": listing_id,
            "applicant_client_id": str(applicant_id),
            "offered_rent": "11500.00",
        },
    )
    assert r.status_code == 201, r.text
    app_id = r.json()["data"]["id"]
    assert r.json()["data"]["status"] == "submitted"

    # submitted → screening → approved
    for target in ("screening", "approved"):
        r = await client.post(
            f"/api/v1/leasing/applications/{app_id}/transition",
            headers=_auth(token),
            json={"status": target},
        )
        assert r.status_code == 200, r.text
        assert r.json()["data"]["status"] == target

    # approved → converted : auto-création du bail effectif (contrat + échéancier).
    r = await client.post(
        f"/api/v1/leasing/applications/{app_id}/transition",
        headers=_auth(token),
        json={"status": "converted"},
    )
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert body["status"] == "converted"
    assert body["decided_at"] is not None
    assert body["converted_rental_id"] is not None


async def test_invalid_listing_transition_409(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    listing_id = await _create_listing(client, token)
    # draft → leased est interdit (saut).
    r = await client.post(
        f"/api/v1/leasing/listings/{listing_id}/transition",
        headers=_auth(token),
        json={"status": "leased"},
    )
    assert r.status_code == 409, r.text
    assert "invalid_transition" in r.json()["detail"]


async def test_invalid_application_transition_409(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    listing_id = await _create_listing(client, token)
    applicant_id = await _create_client(db_session, admin.company_id)
    r = await client.post(
        "/api/v1/leasing/applications",
        headers=_auth(token),
        json={"listing_id": listing_id, "applicant_client_id": str(applicant_id)},
    )
    app_id = r.json()["data"]["id"]
    # submitted → approved est interdit (doit passer par screening).
    r = await client.post(
        f"/api/v1/leasing/applications/{app_id}/transition",
        headers=_auth(token),
        json={"status": "approved"},
    )
    assert r.status_code == 409, r.text


async def test_listing_404_anti_bola(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.get(f"/api/v1/leasing/listings/{_uuid.uuid4()}", headers=_auth(token))
    assert r.status_code == 404
    r = await client.post(
        f"/api/v1/leasing/listings/{_uuid.uuid4()}/transition",
        headers=_auth(token),
        json={"status": "published"},
    )
    assert r.status_code == 404


async def test_application_404_anti_bola(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.get(f"/api/v1/leasing/applications/{_uuid.uuid4()}", headers=_auth(token))
    assert r.status_code == 404


async def test_tenant_isolation_law1(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : une annonce du tenant A est invisible (404) pour le tenant B."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    listing_id = await _create_listing(client, token_a)

    # Tenant B ne voit pas l'annonce de A.
    r = await client.get(f"/api/v1/leasing/listings/{listing_id}", headers=_auth(token_b))
    assert r.status_code == 404, r.text

    # Tenant B ne peut pas la faire transiter.
    r = await client.post(
        f"/api/v1/leasing/listings/{listing_id}/transition",
        headers=_auth(token_b),
        json={"status": "published"},
    )
    assert r.status_code == 404, r.text

    # La liste de B ne contient pas l'annonce de A.
    r = await client.get("/api/v1/leasing/listings", headers=_auth(token_b))
    assert r.status_code == 200, r.text
    ids = [item["id"] for item in r.json()["data"]]
    assert listing_id not in ids


async def test_create_application_rejects_foreign_client(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
) -> None:
    """Loi 1 : un client d'un autre tenant ne peut pas être rattaché à une candidature."""
    _admin, token_a = seed_admin
    company_b, _token_b = second_admin
    listing_id = await _create_listing(client, token_a)
    foreign_client = await _create_client(db_session, company_b.id)

    r = await client.post(
        "/api/v1/leasing/applications",
        headers=_auth(token_a),
        json={"listing_id": listing_id, "applicant_client_id": str(foreign_client)},
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "client_not_in_company"


async def test_list_filters_by_status(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    l1 = await _create_listing(client, token)
    await _create_listing(client, token)
    # Publie une seule annonce.
    await client.post(
        f"/api/v1/leasing/listings/{l1}/transition",
        headers=_auth(token),
        json={"status": "published"},
    )
    r = await client.get("/api/v1/leasing/listings?status=published", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert all(item["status"] == "published" for item in data)
    assert l1 in [item["id"] for item in data]


# ── Helper pur : fin de bail par défaut ───────────────────────────────────────


def test_default_lease_end_is_one_year_minus_a_day() -> None:
    # Bail annuel UAE → fin = début + 12 mois − 1 jour (12 échéances pleines).
    assert service.default_lease_end(date(2026, 1, 1)) == date(2026, 12, 31)
    assert service.default_lease_end(date(2026, 7, 1)) == date(2027, 6, 30)


# ── Conversion en bail effectif (contrat + bail + échéancier) ─────────────────


async def test_convert_creates_effective_lease(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Convertir une candidature approuvée auto-crée contrat + bail + échéancier."""
    admin, token = seed_admin
    unit_id, property_id = await _seed_unit(db_session, admin.company_id)
    app_id, client_id = await _seed_application(db_session, admin.company_id, unit_id=unit_id)

    r = await client.post(
        f"/api/v1/leasing/applications/{app_id}/transition",
        headers=_auth(token),
        json={"status": "converted", "start_date": "2026-07-01"},
    )
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert body["status"] == "converted"
    assert body["converted_rental_id"] is not None

    # Le bail créé porte le tenant, le bien (via legacy_property_id), le loyer offert.
    rental = (
        await db_session.execute(
            select(Rental).where(Rental.id == _uuid.UUID(body["converted_rental_id"]))
        )
    ).scalar_one()
    assert rental.company_id == admin.company_id
    assert rental.property_id == property_id
    assert rental.client_id == client_id
    assert rental.monthly_rent == Decimal("11500.00")
    assert rental.annual_rent == Decimal("138000.00")
    assert rental.status == "active"
    # Bail 12 mois mensuel → 12 échéances.
    assert len(rental.payment_schedule) == 12

    # Le contrat auto-créé est un contrat de location du tenant, réf CNT-….
    contract = (
        await db_session.execute(select(Contract).where(Contract.id == rental.contract_id))
    ).scalar_one()
    assert contract.company_id == admin.company_id
    assert contract.type == "rental"
    assert contract.reference.startswith("CNT-")
    assert contract.amount == Decimal("138000.00")


async def test_convert_without_unit_returns_422(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Une annonce sans unité ne peut pas produire de bail (pas de bien) → 422."""
    admin, token = seed_admin
    app_id, _ = await _seed_application(db_session, admin.company_id, unit_id=None)
    r = await client.post(
        f"/api/v1/leasing/applications/{app_id}/transition",
        headers=_auth(token),
        json={"status": "converted"},
    )
    assert r.status_code == 422, r.text
    assert r.json()["detail"] == "listing_without_unit"


async def test_convert_unit_without_property_returns_422(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Une unité sans bien lié (legacy_property_id null) → 422 (FK contrat/bail)."""
    admin, token = seed_admin
    unit_id, _ = await _seed_unit(db_session, admin.company_id, with_property=False)
    app_id, _ = await _seed_application(db_session, admin.company_id, unit_id=unit_id)
    r = await client.post(
        f"/api/v1/leasing/applications/{app_id}/transition",
        headers=_auth(token),
        json={"status": "converted"},
    )
    assert r.status_code == 422, r.text
    assert r.json()["detail"] == "unit_without_property"


async def test_convert_cross_tenant_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
) -> None:
    """Loi 1 (Red-Team) : le tenant B ne peut PAS convertir la candidature de A → 404."""
    admin_a, _token_a = seed_admin
    _company_b, token_b = second_admin
    unit_id, _ = await _seed_unit(db_session, admin_a.company_id)
    app_id, _ = await _seed_application(db_session, admin_a.company_id, unit_id=unit_id)

    r = await client.post(
        f"/api/v1/leasing/applications/{app_id}/transition",
        headers=_auth(token_b),
        json={"status": "converted"},
    )
    assert r.status_code == 404, r.text
    # Et aucun bail n'a été créé pour B.
    rentals_b = (
        (await db_session.execute(select(Rental).where(Rental.company_id == _company_b.id)))
        .scalars()
        .all()
    )
    assert rentals_b == []
