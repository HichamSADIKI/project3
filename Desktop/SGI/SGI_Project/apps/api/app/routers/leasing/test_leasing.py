"""Tests Leasing / Location — helpers purs + intégration HTTP.

- Helpers purs (sans DB) : generate_reference, machines à états annonce/candidature.
- Intégration HTTP (requiert PostgreSQL — `docker compose exec api uv run pytest`) :
  flux listing→application→screening→approved→converted, isolation multi-tenant
  (Loi 1), 404 anti-BOLA, 409 transition invalide.
"""

import uuid as _uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.company import Company
from app.models.user import User
from app.routers.leasing import service

# ── Helpers purs : generate_reference ─────────────────────────────────────────


def test_generate_reference() -> None:
    assert service.generate_reference(2026, 42) == "LEAS-2026-000042"
    assert service.generate_reference(2026, 1) == "LEAS-2026-000001"
    # Triable lexicographiquement.
    assert service.generate_reference(2026, 5) < service.generate_reference(2026, 50)


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


async def _create_listing(client: AsyncClient, token: str, monthly_rent: str = "12000.00") -> str:
    resp = await client.post(
        "/api/v1/leasing/listings",
        headers=_auth(token),
        json={"monthly_rent": monthly_rent, "title_en": "2BR Marina"},
    )
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
    listing_id = await _create_listing(client, token)

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

    # approved → converted (sans bail rattaché : autorisé, converted_rental_id reste null)
    r = await client.post(
        f"/api/v1/leasing/applications/{app_id}/transition",
        headers=_auth(token),
        json={"status": "converted"},
    )
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert body["status"] == "converted"
    assert body["decided_at"] is not None
    assert body["converted_rental_id"] is None


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


async def test_list_filters_by_status(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
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
