"""Tests unitaires — helpers purs des relevés propriétaires (M6)."""

from decimal import Decimal

import pytest

from app.routers.owner_statements.service import (
    compute_commission,
    is_valid_period,
    net_payout,
    statement_period_label,
)


class TestIsValidPeriod:
    @pytest.mark.parametrize("year,month", [(2026, 1), (2026, 12), (2000, 6)])
    def test_valid(self, year: int, month: int) -> None:
        assert is_valid_period(year, month) is True

    @pytest.mark.parametrize("year,month", [(2026, 0), (2026, 13), (1999, 5), (2101, 1)])
    def test_invalid(self, year: int, month: int) -> None:
        assert is_valid_period(year, month) is False


class TestStatementPeriodLabel:
    def test_pads(self) -> None:
        assert statement_period_label(2026, 5) == "2026-05"

    def test_december(self) -> None:
        assert statement_period_label(2026, 12) == "2026-12"


class TestComputeCommission:
    def test_five_pct(self) -> None:
        assert compute_commission(Decimal("100000"), Decimal("5")) == Decimal("5000.00")

    def test_zero_rate(self) -> None:
        assert compute_commission(Decimal("100000"), Decimal("0")) == Decimal("0.00")

    def test_rounds_half_up(self) -> None:
        # 333.33 * 5% = 16.6665 → 16.67
        assert compute_commission(Decimal("333.33"), Decimal("5")) == Decimal("16.67")


class TestNetPayout:
    def test_basic(self) -> None:
        # 100000 brut - 8000 dépenses - 5000 commission = 87000
        result = net_payout(Decimal("100000"), Decimal("8000"), Decimal("5000"))
        assert result == Decimal("87000.00")

    def test_can_be_negative(self) -> None:
        # dépenses + commission > brut → payout négatif (le propriétaire doit)
        result = net_payout(Decimal("1000"), Decimal("900"), Decimal("200"))
        assert result == Decimal("-100.00")

    def test_quantized(self) -> None:
        result = net_payout(Decimal("100.5"), Decimal("0"), Decimal("0"))
        assert result.as_tuple().exponent == -2
