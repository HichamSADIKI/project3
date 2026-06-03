"""Tests Marketing — helpers purs + intégration HTTP.

- Helpers purs (sans DB) : generate_reference, machine à états campagne, canaux.
- Connecteurs : stubs déterministes sans réseau.
- Intégration HTTP (requiert PostgreSQL — `docker compose exec api uv run pytest`) :
  CRUD/transition/publish, attach cross-tenant → 400, inbound-lead crée un CRMLead
  source='marketing:*' + incrémente leads_count, isolation multi-tenant (Loi 1).
"""

import uuid as _uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.building import Building
from app.models.company import Company
from app.models.crm import CRMLead
from app.models.unit import Unit
from app.models.user import User
from app.routers.marketing import service
from app.routers.marketing.connectors import get_connector

# ── Helpers purs : generate_reference ─────────────────────────────────────────


def test_generate_reference() -> None:
    assert service.generate_reference(2026, 42) == "MKT-2026-000042"
    assert service.generate_reference(2026, 1) == "MKT-2026-000001"
    assert service.generate_reference(2026, 5) < service.generate_reference(2026, 50)


# ── Helpers purs : canaux ─────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "channel",
    [
        "social_facebook",
        "social_instagram",
        "social_linkedin",
        "portal_bayut",
        "portal_propertyfinder",
        "portal_dubizzle",
        "email",
        "other",
    ],
)
def test_valid_channels(channel: str) -> None:
    assert service.is_valid_channel(channel) is True


@pytest.mark.parametrize("channel", ["facebook", "tiktok", "", "social", "Email"])
def test_invalid_channels(channel: str) -> None:
    assert service.is_valid_channel(channel) is False


# ── Helpers purs : machine à états des campagnes ──────────────────────────────


class TestCampaignTransitions:
    @pytest.mark.parametrize(
        "current,target",
        [
            ("draft", "scheduled"),
            ("draft", "active"),
            ("draft", "cancelled"),
            ("scheduled", "active"),
            ("scheduled", "cancelled"),
            ("active", "paused"),
            ("active", "completed"),
            ("active", "cancelled"),
            ("paused", "active"),
            ("paused", "completed"),
            ("paused", "cancelled"),
        ],
    )
    def test_valid(self, current: str, target: str) -> None:
        assert service.is_valid_campaign_transition(current, target) is True

    @pytest.mark.parametrize(
        "current,target",
        [
            # terminaux
            ("completed", "active"),
            ("completed", "draft"),
            ("cancelled", "active"),
            ("cancelled", "draft"),
            # sauts interdits
            ("draft", "paused"),
            ("draft", "completed"),
            ("scheduled", "paused"),
            ("scheduled", "completed"),
            # self-transition
            ("draft", "draft"),
            ("active", "active"),
            # statut inconnu
            ("zzz", "active"),
            ("draft", "zzz"),
        ],
    )
    def test_invalid(self, current: str, target: str) -> None:
        assert service.is_valid_campaign_transition(current, target) is False


# ── Connecteurs : stubs déterministes ─────────────────────────────────────────


def test_connector_stub_deterministic_no_network() -> None:
    cid = _uuid.uuid4()
    conn = get_connector("social_facebook")
    r1 = conn.publish(cid, "MKT-2026-000001", [_uuid.uuid4()])
    r2 = conn.publish(cid, "MKT-2026-000001", [_uuid.uuid4()])
    assert r1.external_ref == r2.external_ref  # déterministe
    assert r1.impressions == r2.impressions
    assert r1.external_ref.startswith("social:")
    assert r1.impressions > 0
    assert r1.clicks >= 0


def test_connector_by_channel_prefix() -> None:
    assert (
        get_connector("portal_bayut")
        .publish(_uuid.uuid4(), "MKT-2026-000002", [])
        .external_ref.startswith("portal:")
    )
    assert (
        get_connector("email")
        .publish(_uuid.uuid4(), "MKT-2026-000003", [])
        .external_ref.startswith("email:")
    )


# ── Intégration HTTP ──────────────────────────────────────────────────────────


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_campaign(
    client: AsyncClient, token: str, channel: str = "social_facebook"
) -> str:
    resp = await client.post(
        "/api/v1/marketing/campaigns",
        headers=_auth(token),
        json={"name": "Marina Launch", "channel": channel, "budget_aed": "5000.00"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]["id"]


async def _create_unit(db_session: AsyncSession, company_id: _uuid.UUID) -> _uuid.UUID:
    building = Building(
        id=_uuid.uuid4(),
        company_id=company_id,
        reference=f"BLD-{_uuid.uuid4().hex[:8]}",
        building_type="residential_tower",
        name_en="Test Tower",
    )
    db_session.add(building)
    await db_session.flush()
    unit = Unit(
        id=_uuid.uuid4(),
        company_id=company_id,
        building_id=building.id,
        unit_number=f"U-{_uuid.uuid4().hex[:6]}",
        unit_type="apartment_2br",
    )
    db_session.add(unit)
    await db_session.commit()
    return unit.id


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/marketing/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "marketing"


async def test_campaigns_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/marketing/campaigns")
    assert resp.status_code in (401, 403)


async def test_create_campaign_sets_reference(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    campaign_id = await _create_campaign(client, token)
    resp = await client.get(f"/api/v1/marketing/campaigns/{campaign_id}", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["reference"].startswith("MKT-")
    assert data["status"] == "draft"


async def test_invalid_channel_400(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    resp = await client.post(
        "/api/v1/marketing/campaigns",
        headers=_auth(token),
        json={"name": "Bad", "channel": "tiktok"},
    )
    # Literal Pydantic → 422 ; au cas où la valeur passe, le service renvoie 400.
    assert resp.status_code in (400, 422), resp.text


async def test_transition_flow_and_409(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    campaign_id = await _create_campaign(client, token)

    for target in ("scheduled", "active", "completed"):
        r = await client.post(
            f"/api/v1/marketing/campaigns/{campaign_id}/transition",
            headers=_auth(token),
            json={"status": target},
        )
        assert r.status_code == 200, r.text
        assert r.json()["data"]["status"] == target

    # completed = terminal → 409.
    r = await client.post(
        f"/api/v1/marketing/campaigns/{campaign_id}/transition",
        headers=_auth(token),
        json={"status": "active"},
    )
    assert r.status_code == 409, r.text
    assert "invalid_transition" in r.json()["detail"]


async def test_illegal_jump_409(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    campaign_id = await _create_campaign(client, token)
    # draft → completed est interdit (saut).
    r = await client.post(
        f"/api/v1/marketing/campaigns/{campaign_id}/transition",
        headers=_auth(token),
        json={"status": "completed"},
    )
    assert r.status_code == 409, r.text


async def test_publish_sets_external_ref_and_published_at(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    campaign_id = await _create_campaign(client, token)
    r = await client.post(
        f"/api/v1/marketing/campaigns/{campaign_id}/publish", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["external_ref"] is not None
    assert data["published_at"] is not None
    assert data["impressions"] > 0


async def test_attach_unit_cross_tenant_400(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
) -> None:
    _admin, token_a = seed_admin
    company_b, _token_b = second_admin
    campaign_id = await _create_campaign(client, token_a)
    foreign_unit = await _create_unit(db_session, company_b.id)
    r = await client.post(
        f"/api/v1/marketing/campaigns/{campaign_id}/units",
        headers=_auth(token_a),
        json={"unit_ids": [str(foreign_unit)]},
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "unit_not_in_company"


async def test_attach_and_detach_unit(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    campaign_id = await _create_campaign(client, token)
    unit_id = await _create_unit(db_session, admin.company_id)
    r = await client.post(
        f"/api/v1/marketing/campaigns/{campaign_id}/units",
        headers=_auth(token),
        json={"unit_ids": [str(unit_id)]},
    )
    assert r.status_code == 200, r.text
    assert any(link["unit_id"] == str(unit_id) for link in r.json()["data"])
    # Détache.
    r = await client.delete(
        f"/api/v1/marketing/campaigns/{campaign_id}/units/{unit_id}", headers=_auth(token)
    )
    assert r.status_code == 200, r.text


async def test_inbound_lead_creates_crm_lead(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    _admin, token = seed_admin
    campaign_id = await _create_campaign(client, token)
    email = f"prospect-{_uuid.uuid4().hex[:8]}@example.com"
    r = await client.post(
        f"/api/v1/marketing/campaigns/{campaign_id}/inbound-lead",
        headers=_auth(token),
        json={
            "contact": {"name": "Jane Buyer", "email": email},
            "message": "Interested in the Marina unit",
            "budget": "2500000.00",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["source"].startswith("marketing:MKT-")
    assert body["leads_count"] == 1
    assert body["reference"].startswith("CRM-")

    # Le lead existe bien en base avec la bonne source.
    lead = (
        await db_session.execute(select(CRMLead).where(CRMLead.id == _uuid.UUID(body["lead_id"])))
    ).scalar_one()
    assert lead.source == body["source"]
    assert lead.status == "new"
    assert lead.category == "realestate"

    # leads_count incrémenté sur la campagne.
    c = await client.get(f"/api/v1/marketing/campaigns/{campaign_id}", headers=_auth(token))
    assert c.json()["data"]["leads_count"] == 1


async def test_inbound_lead_no_contact_400(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    campaign_id = await _create_campaign(client, token)
    r = await client.post(
        f"/api/v1/marketing/campaigns/{campaign_id}/inbound-lead",
        headers=_auth(token),
        json={"contact": {}},
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "no_contact"


async def test_kpis(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    cid = await _create_campaign(client, token)
    await client.post(f"/api/v1/marketing/campaigns/{cid}/publish", headers=_auth(token))
    r = await client.get("/api/v1/marketing/kpis", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["total_campaigns"] >= 1
    assert data["impressions"] > 0
    assert "draft" in data["by_status"]


async def test_campaign_404_anti_bola(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.get(f"/api/v1/marketing/campaigns/{_uuid.uuid4()}", headers=_auth(token))
    assert r.status_code == 404
    r = await client.post(
        f"/api/v1/marketing/campaigns/{_uuid.uuid4()}/transition",
        headers=_auth(token),
        json={"status": "active"},
    )
    assert r.status_code == 404


async def test_tenant_isolation_law1(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : une campagne du tenant A est invisible (404) pour le tenant B."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    campaign_id = await _create_campaign(client, token_a)

    r = await client.get(f"/api/v1/marketing/campaigns/{campaign_id}", headers=_auth(token_b))
    assert r.status_code == 404, r.text

    r = await client.post(
        f"/api/v1/marketing/campaigns/{campaign_id}/transition",
        headers=_auth(token_b),
        json={"status": "active"},
    )
    assert r.status_code == 404, r.text

    r = await client.get("/api/v1/marketing/campaigns", headers=_auth(token_b))
    assert r.status_code == 200, r.text
    ids = [item["id"] for item in r.json()["data"]]
    assert campaign_id not in ids
