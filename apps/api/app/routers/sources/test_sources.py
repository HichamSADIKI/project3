"""Tests Sources — helpers purs + intégration HTTP (dédup / idempotence / Loi 1).

- Helpers purs (sans DB) : normalize_email/phone, compute_dedup_key,
  generate_reference, map_to_lead_payload, is_valid_source_type.
- Intégration HTTP (requiert PostgreSQL — `docker compose exec api uv run pytest`) :
  ingestion CSV/webhook, dédup/idempotence (réimport même external_id → 1 lead,
  2e='duplicate'), rejet (contact vide), isolation multi-tenant (Loi 1).
"""

import uuid as _uuid

import pytest
from httpx import AsyncClient

from app.models.company import Company
from app.models.user import User
from app.routers.sources import service

# ── Helpers purs : generate_reference ─────────────────────────────────────────


def test_generate_reference() -> None:
    assert service.generate_reference(2026, 42) == "SRC-2026-000042"
    assert service.generate_reference(2026, 1) == "SRC-2026-000001"
    # Triable lexicographiquement.
    assert service.generate_reference(2026, 5) < service.generate_reference(2026, 50)


# ── Helpers purs : normalisation ──────────────────────────────────────────────


class TestNormalizeEmail:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("  John.Doe@Example.COM ", "john.doe@example.com"),
            ("a@b.co", "a@b.co"),
        ],
    )
    def test_valid(self, raw: str, expected: str) -> None:
        assert service.normalize_email(raw) == expected

    @pytest.mark.parametrize("raw", [None, "", "no-at-sign", "bad@nodot", "@example.com", "x@"])
    def test_invalid(self, raw: str | None) -> None:
        assert service.normalize_email(raw) is None


class TestNormalizePhone:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("+971 50 123 4567", "+971501234567"),
            ("0050 123", "+50123"),
            ("050-123-4567", "0501234567"),
        ],
    )
    def test_valid(self, raw: str, expected: str) -> None:
        assert service.normalize_phone(raw) == expected

    @pytest.mark.parametrize("raw", [None, "", "   ", "abc"])
    def test_empty(self, raw: str | None) -> None:
        assert service.normalize_phone(raw) is None


class TestComputeDedupKey:
    def test_email_priority(self) -> None:
        assert service.compute_dedup_key("X@Y.com", "+971500000000") == "email:x@y.com"

    def test_phone_fallback(self) -> None:
        assert service.compute_dedup_key(None, "+971500000000") == "phone:+971500000000"

    def test_empty_when_no_contact(self) -> None:
        assert service.compute_dedup_key(None, None) == ""
        assert service.compute_dedup_key("not-an-email", "abc") == ""


def test_is_valid_source_type() -> None:
    assert service.is_valid_source_type("contract") is True
    assert service.is_valid_source_type("social") is True
    assert service.is_valid_source_type("zzz") is False


def test_map_to_lead_payload() -> None:
    raw = {
        "contact": {"first_name": "Jane", "last_name": "Roe", "email": "JANE@x.com"},
        "budget": "750000",
        "property_type": "apartment",
        "location": "Marina",
        "message": "Interested",
    }
    out = service.map_to_lead_payload(raw, "social")
    assert out["name"] == "Jane Roe"
    assert out["email"] == "jane@x.com"
    assert out["property_type"] == "apartment"
    assert out["preferred_location"] == "Marina"
    assert out["source_type"] == "social"


# ── Intégration HTTP ──────────────────────────────────────────────────────────


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/sources/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "sources"


async def test_imports_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/sources/imports")
    assert resp.status_code in (401, 403)


async def test_csv_import_creates_lead(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    email = f"buyer-{_uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/api/v1/sources/imports/csv",
        headers=_auth(token),
        json={
            "source_type": "existing_customer",
            "source_channel": "csv",
            "rows": [
                {
                    "external_id": "cust-1",
                    "name": "Buyer One",
                    "email": email,
                    "budget": "2500000",
                    "property_type": "villa",
                }
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    summary = resp.json()["data"]
    assert summary == {"imported": 1, "duplicates": 0, "rejected": 0}

    # Le lead CRM existe et porte la provenance.
    leads = await client.get("/api/v1/crm/leads", headers=_auth(token))
    assert leads.status_code == 200, leads.text
    sources = [item.get("source") for item in leads.json()["data"]]
    assert any(s and s.startswith("existing_customer:") for s in sources)


async def test_idempotent_reimport_same_external_id(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """Réimport du même external_id → 1 seul lead, 2e import = 'duplicate'."""
    _admin, token = seed_admin
    email = f"dedup-{_uuid.uuid4().hex[:8]}@example.com"
    row = {"external_id": "ext-42", "name": "Dup Lead", "email": email}

    r1 = await client.post(
        "/api/v1/sources/imports/csv",
        headers=_auth(token),
        json={"source_type": "social", "source_channel": "webhook:facebook", "rows": [row]},
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["data"]["imported"] == 1

    r2 = await client.post(
        "/api/v1/sources/imports/csv",
        headers=_auth(token),
        json={"source_type": "social", "source_channel": "webhook:facebook", "rows": [row]},
    )
    assert r2.status_code == 201, r2.text
    assert r2.json()["data"] == {"imported": 0, "duplicates": 1, "rejected": 0}

    # Un seul lead créé pour cet email.
    leads = await client.get("/api/v1/crm/leads", headers=_auth(token), params={"limit": 100})
    matching = [
        item for item in leads.json()["data"] if item.get("source") == "social:webhook:facebook"
    ]
    assert len(matching) == 1


async def test_rejects_record_without_contact(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    resp = await client.post(
        "/api/v1/sources/imports/csv",
        headers=_auth(token),
        json={
            "source_type": "other",
            "rows": [{"external_id": "no-contact-1", "name": "Ghost"}],
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"] == {"imported": 0, "duplicates": 0, "rejected": 1}

    # Le rejet est journalisé avec une raison.
    listing = await client.get("/api/v1/sources/imports?status=rejected", headers=_auth(token))
    assert listing.status_code == 200, listing.text
    rows = listing.json()["data"]
    assert any(r["reject_reason"] == "no_contact" for r in rows)


async def test_webhook_import_single_record(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    resp = await client.post(
        "/api/v1/sources/imports/webhook",
        headers=_auth(token),
        json={
            "source_type": "social",
            "source_channel": "webhook:instagram",
            "external_id": "ig-7",
            "payload": {"contact": {"name": "Insta Lead", "phone": "+971500000007"}},
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["status"] == "imported"
    assert data["reference"].startswith("SRC-")
    assert data["created_lead_id"] is not None


async def test_import_404_anti_bola(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.get(f"/api/v1/sources/imports/{_uuid.uuid4()}", headers=_auth(token))
    assert r.status_code == 404


async def test_tenant_isolation_law1(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : un import du tenant A est invisible (liste + 404) pour le tenant B."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin

    email = f"iso-{_uuid.uuid4().hex[:8]}@example.com"
    r = await client.post(
        "/api/v1/sources/imports/webhook",
        headers=_auth(token_a),
        json={
            "source_type": "other",
            "external_id": "iso-1",
            "payload": {"contact": {"name": "Iso", "email": email}},
        },
    )
    assert r.status_code == 201, r.text
    import_id = r.json()["data"]["id"]

    # Tenant B ne voit pas l'import de A.
    r = await client.get(f"/api/v1/sources/imports/{import_id}", headers=_auth(token_b))
    assert r.status_code == 404, r.text

    # La liste de B ne contient pas l'import de A.
    r = await client.get("/api/v1/sources/imports", headers=_auth(token_b))
    assert r.status_code == 200, r.text
    ids = [item["id"] for item in r.json()["data"]]
    assert import_id not in ids
