"""Tests unitaires — helpers métier purs du module contracts (renouvellement M5)."""
from datetime import date
from decimal import Decimal

import pytest

from app.routers.contracts.service import (
    apply_rent_escalation,
    compute_renewal_dates,
    is_renewable,
)


class TestIsRenewable:
    @pytest.mark.parametrize("status", ["active", "expired"])
    def test_renewable_states(self, status: str) -> None:
        assert is_renewable(status) is True

    @pytest.mark.parametrize("status", ["draft", "signed", "cancelled", "bogus"])
    def test_non_renewable_states(self, status: str) -> None:
        assert is_renewable(status) is False


class TestComputeRenewalDates:
    def test_new_start_is_day_after_old_end(self) -> None:
        start, _end = compute_renewal_dates(date(2025, 1, 1), date(2025, 12, 31))
        assert start == date(2026, 1, 1)

    def test_reconducts_duration_when_no_term(self) -> None:
        start, end = compute_renewal_dates(date(2025, 1, 1), date(2025, 12, 31))
        assert start == date(2026, 1, 1)
        assert end is not None and end > start

    def test_explicit_term_months(self) -> None:
        start, end = compute_renewal_dates(date(2025, 1, 1), date(2025, 6, 30), 24)
        assert start == date(2025, 7, 1)
        assert end == date(2027, 7, 1)

    def test_none_end_returns_none(self) -> None:
        assert compute_renewal_dates(None, None) == (None, None)

    def test_no_old_start_defaults_12_months(self) -> None:
        start, end = compute_renewal_dates(None, date(2025, 6, 30))
        assert start == date(2025, 7, 1)
        assert end == date(2026, 7, 1)


class TestApplyRentEscalation:
    def test_zero_pct_unchanged(self) -> None:
        assert apply_rent_escalation(Decimal("100000"), Decimal("0")) == Decimal("100000.00")

    def test_five_pct(self) -> None:
        assert apply_rent_escalation(Decimal("100000"), Decimal("5")) == Decimal("105000.00")

    def test_rounds_half_up_two_decimals(self) -> None:
        # 99999 * 1.075 = 107498.925 → 107498.93
        assert apply_rent_escalation(Decimal("99999"), Decimal("7.5")) == Decimal("107498.93")

    def test_result_quantized(self) -> None:
        result = apply_rent_escalation(Decimal("12345"), Decimal("3.3"))
        assert result.as_tuple().exponent == -2
