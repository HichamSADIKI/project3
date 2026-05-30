"""Tests unitaires — module technicians.

La logique de rating est partagée avec vendors (helper `merge_rating`).
Ces tests valident que technicians.add_rating consomme bien ce helper.
"""

from decimal import Decimal

from app.routers.vendors.service import merge_rating


class TestSharedRatingFormula:
    """Vérifie que la formule de notation est cohérente entre vendors/technicians."""

    def test_single_rating(self) -> None:
        avg, count = merge_rating(Decimal("0"), 0, Decimal("4.8"))
        assert avg == Decimal("4.80")
        assert count == 1

    def test_perfect_streak(self) -> None:
        # 5 notes parfaites successives
        avg, count = Decimal("0"), 0
        for _ in range(5):
            avg, count = merge_rating(avg, count, Decimal("5.0"))
        assert avg == Decimal("5.00")
        assert count == 5

    def test_mixed_history(self) -> None:
        # Notes 5, 4, 3, 5 → moyenne 4.25
        avg, count = Decimal("0"), 0
        for s in [Decimal("5"), Decimal("4"), Decimal("3"), Decimal("5")]:
            avg, count = merge_rating(avg, count, s)
        assert avg == Decimal("4.25")
        assert count == 4
