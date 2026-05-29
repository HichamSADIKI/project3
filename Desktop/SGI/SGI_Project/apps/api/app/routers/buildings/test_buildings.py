"""Tests unitaires — helpers métier purs du module buildings."""
from decimal import Decimal

import pytest

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
