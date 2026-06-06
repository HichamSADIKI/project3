"""Tests unitaires — transitions de statut Unit."""

import pytest

from app.routers.units.service import is_valid_status_transition


class TestUnitStatusTransitions:
    @pytest.mark.parametrize(
        "current,target",
        [
            # Depuis vacant
            ("vacant", "reserved"),
            ("vacant", "occupied"),
            ("vacant", "maintenance"),
            ("vacant", "renovation"),
            ("vacant", "off_market"),
            # Depuis reserved
            ("reserved", "occupied"),
            ("reserved", "vacant"),
            # Depuis occupied
            ("occupied", "vacant"),
            ("occupied", "maintenance"),
            # Depuis maintenance
            ("maintenance", "vacant"),
            ("maintenance", "renovation"),
            # Depuis renovation
            ("renovation", "vacant"),
            ("renovation", "maintenance"),
            # Retour depuis off_market
            ("off_market", "vacant"),
        ],
    )
    def test_valid_transitions(self, current: str, target: str) -> None:
        assert is_valid_status_transition(current, target) is True

    @pytest.mark.parametrize(
        "current,target",
        [
            # Ne pas passer d'occupé directement à autre chose que vacant/maintenance
            ("occupied", "reserved"),
            ("occupied", "renovation"),
            ("occupied", "off_market"),
            # Reserved ne peut pas aller en maintenance directement
            ("reserved", "maintenance"),
            ("reserved", "renovation"),
            # off_market doit repasser par vacant
            ("off_market", "occupied"),
            ("off_market", "maintenance"),
            # Self-transitions invalides
            ("vacant", "vacant"),
            ("occupied", "occupied"),
        ],
    )
    def test_invalid_transitions(self, current: str, target: str) -> None:
        assert is_valid_status_transition(current, target) is False

    def test_unknown_status(self) -> None:
        assert is_valid_status_transition("foo", "vacant") is False


# ─── Tests d'intégration endpoints — machine à états via l'API ──────────────
# Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest

import uuid as _uuid

from httpx import AsyncClient

from app.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_building_and_unit(client: AsyncClient, token: str) -> str:
    """Crée un bâtiment + une unité (vacant) et renvoie l'id de l'unité."""
    b = await client.post(
        "/api/v1/buildings/",
        headers=_auth(token),
        json={"reference": f"BLD-{_uuid.uuid4().hex[:8]}", "building_type": "residential_tower"},
    )
    assert b.status_code == 201, b.text
    building_id = b.json()["data"]["id"]
    u = await client.post(
        "/api/v1/units/",
        headers=_auth(token),
        json={"building_id": building_id, "unit_number": "101", "unit_type": "apartment_1br"},
    )
    assert u.status_code == 201, u.text
    return u.json()["data"]["id"]


async def test_unit_status_requires_auth(client: AsyncClient) -> None:
    # Endpoint protégé (require_roles + contexte tenant) : un appel anonyme est
    # rejeté avant toute mutation — 403 (rôle absent) ou 401 (tenant manquant).
    resp = await client.post(
        f"/api/v1/units/{_uuid.uuid4()}/status", json={"target_status": "reserved"}
    )
    assert resp.status_code in (401, 403)


async def test_unit_status_valid_transition(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    unit_id = await _create_building_and_unit(client, token)
    # vacant → reserved : transition autorisée par la machine à états.
    resp = await client.post(
        f"/api/v1/units/{unit_id}/status", headers=_auth(token), json={"target_status": "reserved"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "reserved"


async def test_unit_status_invalid_transition_422(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    unit_id = await _create_building_and_unit(client, token)
    # vacant → reserved (ok), puis reserved → off_market (interdit) → 422.
    await client.post(
        f"/api/v1/units/{unit_id}/status", headers=_auth(token), json={"target_status": "reserved"}
    )
    resp = await client.post(
        f"/api/v1/units/{unit_id}/status",
        headers=_auth(token),
        json={"target_status": "off_market"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"] == "invalid_status_transition"


async def test_unit_not_found_404(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    resp = await client.post(
        f"/api/v1/units/{_uuid.uuid4()}/status",
        headers=_auth(token),
        json={"target_status": "reserved"},
    )
    assert resp.status_code == 404


# ─── Taux d'occupation (pur) ─────────────────────────────────────────────────

from types import SimpleNamespace  # noqa: E402

from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.models.building import Building  # noqa: E402
from app.models.company import Company  # noqa: E402
from app.models.unit import Unit  # noqa: E402
from app.routers.units.service import summarize_occupancy  # noqa: E402


def _u(status: str):
    return SimpleNamespace(status=status)


class TestSummarizeOccupancy:
    def test_empty(self) -> None:
        s = summarize_occupancy([])
        assert s["total_units"] == 0
        assert s["occupancy_rate_pct"] == 0

    def test_rate_excludes_off_market(self) -> None:
        # 2 occupées sur parc louable de 3 (off_market exclu) → 67 %
        units = [_u("occupied"), _u("occupied"), _u("vacant"), _u("off_market")]
        s = summarize_occupancy(units)
        assert s["total_units"] == 4
        assert s["by_status"]["occupied"] == 2
        assert s["by_status"]["off_market"] == 1
        assert s["occupancy_rate_pct"] == 67

    def test_all_off_market_rate_zero(self) -> None:
        s = summarize_occupancy([_u("off_market"), _u("off_market")])
        assert s["occupancy_rate_pct"] == 0
        assert s["total_units"] == 2


# ─── Endpoint /units/occupancy (intégration) ─────────────────────────────────


async def _seed_units(db: AsyncSession, company_id, statuses: list[str]):
    building = Building(
        id=_uuid.uuid4(),
        company_id=company_id,
        reference=f"BLD-{_uuid.uuid4().hex[:10]}",
        building_type="residential_tower",
    )
    db.add(building)
    await db.commit()
    for n, st in enumerate(statuses):
        db.add(
            Unit(
                id=_uuid.uuid4(),
                company_id=company_id,
                building_id=building.id,
                unit_number=f"U-{n}-{_uuid.uuid4().hex[:4]}",
                unit_type="apartment_1br",
                status=st,
            )
        )
    await db.commit()
    return building.id


async def test_occupancy_endpoint(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_company: Company,
    seed_admin: tuple[User, str],
) -> None:
    _admin, token = seed_admin
    await _seed_units(db_session, seed_company.id, ["occupied", "occupied", "vacant", "off_market"])
    r = await client.get("/api/v1/units/occupancy", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["total_units"] == 4
    assert data["by_status"]["occupied"] == 2
    assert data["occupancy_rate_pct"] == 67


async def test_occupancy_tenant_isolation(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_company: Company,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    _admin, _token_a = seed_admin
    _company_b, token_b = second_admin
    await _seed_units(db_session, seed_company.id, ["occupied", "vacant"])
    r = await client.get("/api/v1/units/occupancy", headers=_auth(token_b))
    assert r.status_code == 200
    assert r.json()["data"]["total_units"] == 0
