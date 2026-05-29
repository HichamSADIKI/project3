"""Tests unitaires — helpers métier purs du module owners.

Couverture : helpers de mandat (actif, jours restants, alerte renouvellement).
Tests d'intégration DB → à ajouter avec conftest.py async + tenant fixture.
"""
from datetime import date

import pytest

from app.routers.owners.service import (
    days_until_mandate_expiry,
    mandate_is_active,
    needs_renewal_alert,
)


# ─── mandate_is_active ─────────────────────────────────────────────────────


class TestMandateIsActive:
    def test_both_dates_none_returns_false(self) -> None:
        assert mandate_is_active(date(2026, 5, 28), None, None) is False

    def test_within_period_returns_true(self) -> None:
        assert (
            mandate_is_active(
                date(2026, 5, 28), date(2026, 1, 1), date(2026, 12, 31)
            )
            is True
        )

    def test_before_start_returns_false(self) -> None:
        assert (
            mandate_is_active(
                date(2025, 12, 31), date(2026, 1, 1), date(2026, 12, 31)
            )
            is False
        )

    def test_after_end_returns_false(self) -> None:
        assert (
            mandate_is_active(
                date(2027, 1, 1), date(2026, 1, 1), date(2026, 12, 31)
            )
            is False
        )

    def test_exact_start_date_is_active(self) -> None:
        assert (
            mandate_is_active(
                date(2026, 1, 1), date(2026, 1, 1), date(2026, 12, 31)
            )
            is True
        )

    def test_exact_end_date_is_active(self) -> None:
        assert (
            mandate_is_active(
                date(2026, 12, 31), date(2026, 1, 1), date(2026, 12, 31)
            )
            is True
        )

    def test_no_end_open_ended_active_when_after_start(self) -> None:
        assert mandate_is_active(date(2030, 1, 1), date(2026, 1, 1), None) is True

    def test_no_start_only_end_active_until_expiry(self) -> None:
        assert mandate_is_active(date(2026, 5, 28), None, date(2027, 1, 1)) is True


# ─── days_until_mandate_expiry ─────────────────────────────────────────────


class TestDaysUntilMandateExpiry:
    def test_none_when_no_end_date(self) -> None:
        assert days_until_mandate_expiry(date(2026, 5, 28), None) is None

    def test_positive_when_in_future(self) -> None:
        assert (
            days_until_mandate_expiry(date(2026, 5, 28), date(2026, 7, 27)) == 60
        )

    def test_zero_on_expiry_day(self) -> None:
        assert (
            days_until_mandate_expiry(date(2026, 5, 28), date(2026, 5, 28)) == 0
        )

    def test_negative_when_expired(self) -> None:
        assert (
            days_until_mandate_expiry(date(2026, 5, 28), date(2026, 5, 20)) == -8
        )


# ─── needs_renewal_alert ───────────────────────────────────────────────────


class TestNeedsRenewalAlert:
    def test_false_when_no_end_date(self) -> None:
        assert needs_renewal_alert(date(2026, 5, 28), None) is False

    def test_true_within_default_60_day_window(self) -> None:
        assert needs_renewal_alert(date(2026, 5, 28), date(2026, 6, 27)) is True

    def test_false_when_expired(self) -> None:
        assert needs_renewal_alert(date(2026, 5, 28), date(2026, 5, 20)) is False

    def test_false_when_too_far_in_future(self) -> None:
        assert needs_renewal_alert(date(2026, 5, 28), date(2026, 12, 31)) is False

    @pytest.mark.parametrize("threshold,days_ahead,expected", [
        (30, 25, True),
        (30, 35, False),
        (90, 60, True),
        (90, 91, False),
    ])
    def test_custom_threshold(
        self, threshold: int, days_ahead: int, expected: bool
    ) -> None:
        from datetime import timedelta

        today = date(2026, 5, 28)
        end = today + timedelta(days=days_ahead)
        assert needs_renewal_alert(today, end, threshold) is expected
