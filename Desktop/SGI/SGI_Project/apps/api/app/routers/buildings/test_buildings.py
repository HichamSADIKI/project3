"""Tests unitaires — helpers métier purs du module buildings.

Inclut aussi un test d'intégration de l'endpoint imbriqué
GET /buildings/{id}/units (requiert PostgreSQL — lancer dans le conteneur).
"""
import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.models.company import Company
from app.models.user import User
from app.routers.buildings.service import compute_occupancy


class TestComputeOccupancy:
    def test_empty_building(self) -> None:
        occ, vac = compute_occupancy({})
        assert occ == Decimal("0.00")
        assert vac == Decimal("0.00")

    def test_all_units_off_market_excluded_from_denominator(self) -> None:
        # 10 unités hors marché → 0% occupé, 0% vacant
        occ, vac = compute_occupancy(
            {"maintenance": 5, "renovation": 3, "off_market": 2}
        )
        assert occ == Decimal("0.00")
        assert vac == Decimal("0.00")

    def test_full_occupation(self) -> None:
        occ, vac = compute_occupancy({"occupied": 10})
        assert occ == Decimal("100.00")
        assert vac == Decimal("0.00")

    def test_reserved_counts_as_occupied(self) -> None:
        # 5 occupés + 5 réservés sur 10 = 100% occupancy
        occ, vac = compute_occupancy({"occupied": 5, "reserved": 5})
        assert occ == Decimal("100.00")
        assert vac == Decimal("0.00")

    def test_mixed(self) -> None:
        # 7 occupés + 3 vacants = 70% / 30%
        occ, vac = compute_occupancy({"occupied": 7, "vacant": 3})
        assert occ == Decimal("70.00")
        assert vac == Decimal("30.00")

    def test_maintenance_excluded(self) -> None:
        # 4 occupés + 2 vacants + 4 en maintenance → 4/6 = 66.67%
        occ, vac = compute_occupancy(
            {"occupied": 4, "vacant": 2, "maintenance": 4}
        )
        assert occ == Decimal("66.67")
        assert vac == Decimal("33.33")

    @pytest.mark.parametrize("occupied,vacant,expected_occ", [
        (1, 1, Decimal("50.00")),
        (3, 1, Decimal("75.00")),
        (1, 3, Decimal("25.00")),
        (2, 1, Decimal("66.67")),
    ])
    def test_parametrized_ratios(
        self, occupied: int, vacant: int, expected_occ: Decimal
    ) -> None:
        occ, _ = compute_occupancy({"occupied": occupied, "vacant": vacant})
        assert occ == expected_occ


# ─── Endpoint imbriqué GET /buildings/{id}/units (intégration) ──────────────
# (asyncio_mode = "auto" → les fonctions async sont détectées automatiquement)


def _admin_headers(seed_admin: tuple[User, str]) -> dict[str, str]:
    _admin, token = seed_admin
    return {"Authorization": f"Bearer {token}"}


async def test_nested_units_lists_only_building_units(
    client: AsyncClient, seed_admin: tuple[User, str], seed_company: Company
) -> None:
    headers = _admin_headers(seed_admin)

    # Deux bâtiments dans le même tenant.
    b1 = await client.post("/api/v1/buildings/", headers=headers,
        json={"reference": f"BLD-{uuid.uuid4().hex[:8]}", "building_type": "residential_tower"})
    assert b1.status_code == 201, b1.text
    b1_id = b1.json()["data"]["id"]
    b2 = await client.post("/api/v1/buildings/", headers=headers,
        json={"reference": f"BLD-{uuid.uuid4().hex[:8]}", "building_type": "residential_tower"})
    b2_id = b2.json()["data"]["id"]

    # Une unité dans chaque bâtiment.
    u1 = await client.post("/api/v1/units/", headers=headers,
        json={"building_id": b1_id, "unit_number": "101", "unit_type": "apartment_1br"})
    assert u1.status_code == 201, u1.text
    await client.post("/api/v1/units/", headers=headers,
        json={"building_id": b2_id, "unit_number": "201", "unit_type": "studio"})

    # L'endpoint imbriqué ne renvoie que les unités du bâtiment 1.
    resp = await client.get(f"/api/v1/buildings/{b1_id}/units", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    returned_buildings = {u["building_id"] for u in body["data"]}
    assert returned_buildings == {b1_id}
    assert body["meta"]["total"] == 1


async def test_nested_units_unknown_building_404(
    client: AsyncClient, seed_admin: tuple[User, str], seed_company: Company
) -> None:
    headers = _admin_headers(seed_admin)
    resp = await client.get(f"/api/v1/buildings/{uuid.uuid4()}/units", headers=headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "building_not_found"
