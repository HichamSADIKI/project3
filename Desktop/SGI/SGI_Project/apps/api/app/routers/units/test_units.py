"""Tests unitaires — transitions de statut Unit."""
import pytest

from app.routers.units.service import is_valid_status_transition


class TestUnitStatusTransitions:
    @pytest.mark.parametrize("current,target", [
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
    ])
    def test_valid_transitions(self, current: str, target: str) -> None:
        assert is_valid_status_transition(current, target) is True

    @pytest.mark.parametrize("current,target", [
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
    ])
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
    b = await client.post("/api/v1/buildings/", headers=_auth(token),
        json={"reference": f"BLD-{_uuid.uuid4().hex[:8]}", "building_type": "residential_tower"})
    assert b.status_code == 201, b.text
    building_id = b.json()["data"]["id"]
    u = await client.post("/api/v1/units/", headers=_auth(token),
        json={"building_id": building_id, "unit_number": "101", "unit_type": "apartment_1br"})
    assert u.status_code == 201, u.text
    return u.json()["data"]["id"]


async def test_unit_status_requires_auth(client: AsyncClient) -> None:
    # Endpoint protégé (require_roles + contexte tenant) : un appel anonyme est
    # rejeté avant toute mutation — 403 (rôle absent) ou 401 (tenant manquant).
    resp = await client.post(f"/api/v1/units/{_uuid.uuid4()}/status",
                             json={"target_status": "reserved"})
    assert resp.status_code in (401, 403)


async def test_unit_status_valid_transition(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    unit_id = await _create_building_and_unit(client, token)
    # vacant → reserved : transition autorisée par la machine à états.
    resp = await client.post(f"/api/v1/units/{unit_id}/status", headers=_auth(token),
                             json={"target_status": "reserved"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "reserved"


async def test_unit_status_invalid_transition_422(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    unit_id = await _create_building_and_unit(client, token)
    # vacant → reserved (ok), puis reserved → off_market (interdit) → 422.
    await client.post(f"/api/v1/units/{unit_id}/status", headers=_auth(token),
                      json={"target_status": "reserved"})
    resp = await client.post(f"/api/v1/units/{unit_id}/status", headers=_auth(token),
                             json={"target_status": "off_market"})
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"] == "invalid_status_transition"


async def test_unit_not_found_404(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    resp = await client.post(f"/api/v1/units/{_uuid.uuid4()}/status", headers=_auth(token),
                             json={"target_status": "reserved"})
    assert resp.status_code == 404
