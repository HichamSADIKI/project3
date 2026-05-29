"""Tests unitaires — helpers métier purs du module PDC."""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.routers.pdc.service import (
    aggregate_outstanding,
    days_to_due,
    generate_reference,
    is_overdue,
    is_valid_pdc_transition,
)


# ─── Transitions de cycle de vie ──────────────────────────────────────────


class TestPdcTransitions:
    @pytest.mark.parametrize("current,target", [
        ("pending", "deposited"),
        ("pending", "cancelled"),
        ("deposited", "cleared"),
        ("deposited", "bounced"),
        ("bounced", "replaced"),
    ])
    def test_valid_transitions(self, current: str, target: str) -> None:
        assert is_valid_pdc_transition(current, target) is True

    @pytest.mark.parametrize("current,target", [
        # Ne peut pas sauter l'étape deposited
        ("pending", "cleared"),
        ("pending", "bounced"),
        # cleared est terminal
        ("cleared", "deposited"),
        ("cleared", "bounced"),
        ("cleared", "cancelled"),
        # replaced est terminal
        ("replaced", "pending"),
        ("replaced", "bounced"),
        # cancelled est terminal
        ("cancelled", "pending"),
        # bounced ne peut aller QUE vers replaced
        ("bounced", "cleared"),
        ("bounced", "cancelled"),
        # Pas de retour en arrière
        ("deposited", "pending"),
    ])
    def test_invalid_transitions(self, current: str, target: str) -> None:
        assert is_valid_pdc_transition(current, target) is False

    def test_cleared_is_terminal(self) -> None:
        # Aucune transition possible depuis cleared
        for target in ("pending", "deposited", "cleared", "bounced", "replaced", "cancelled"):
            assert is_valid_pdc_transition("cleared", target) is False


# ─── days_to_due ──────────────────────────────────────────────────────────


class TestDaysToDue:
    def test_future(self) -> None:
        assert days_to_due(date(2026, 5, 28), date(2026, 6, 28)) == 31

    def test_today(self) -> None:
        assert days_to_due(date(2026, 5, 28), date(2026, 5, 28)) == 0

    def test_past_returns_negative(self) -> None:
        assert days_to_due(date(2026, 5, 28), date(2026, 5, 20)) == -8


# ─── is_overdue ───────────────────────────────────────────────────────────


class TestIsOverdue:
    today = date(2026, 5, 28)

    def test_pending_past_due_is_overdue(self) -> None:
        assert is_overdue(self.today, date(2026, 5, 20), "pending") is True

    def test_pending_future_is_not_overdue(self) -> None:
        assert is_overdue(self.today, date(2026, 6, 28), "pending") is False

    def test_pending_due_today_is_not_overdue(self) -> None:
        # due_date == today : pas encore en retard
        assert is_overdue(self.today, self.today, "pending") is False

    def test_deposited_is_not_overdue_even_if_past_due(self) -> None:
        assert is_overdue(self.today, date(2026, 5, 20), "deposited") is False

    @pytest.mark.parametrize("status", ["cleared", "bounced", "replaced", "cancelled"])
    def test_terminal_statuses_never_overdue(self, status: str) -> None:
        assert is_overdue(self.today, date(2020, 1, 1), status) is False


# ─── generate_reference ───────────────────────────────────────────────────


class TestGenerateReference:
    def test_format(self) -> None:
        assert generate_reference(2026, 1) == "PDC-2026-000001"
        assert generate_reference(2026, 42) == "PDC-2026-000042"
        assert generate_reference(2026, 999999) == "PDC-2026-999999"

    def test_sortable_alphabetically(self) -> None:
        # Le format à 6 chiffres garantit le tri lexicographique correct
        refs = [generate_reference(2026, n) for n in [1, 10, 100, 1000]]
        assert sorted(refs) == refs


# ─── aggregate_outstanding ────────────────────────────────────────────────


class TestAggregateOutstanding:
    def _make(self, status: str, amount: str) -> object:
        return SimpleNamespace(status=status, amount_aed=Decimal(amount))

    def test_empty_list(self) -> None:
        assert aggregate_outstanding([]) == Decimal("0.00")

    def test_only_pending(self) -> None:
        cheques = [self._make("pending", "5000"), self._make("pending", "5000")]
        assert aggregate_outstanding(cheques) == Decimal("10000")

    def test_excludes_cleared_and_bounced(self) -> None:
        cheques = [
            self._make("pending", "5000"),
            self._make("deposited", "5000"),
            self._make("cleared", "5000"),
            self._make("bounced", "5000"),
            self._make("replaced", "5000"),
            self._make("cancelled", "5000"),
        ]
        # pending + deposited uniquement = 10 000
        assert aggregate_outstanding(cheques) == Decimal("10000")

    def test_pending_and_deposited_summed(self) -> None:
        cheques = [
            self._make("pending", "3000"),
            self._make("deposited", "7500.50"),
        ]
        assert aggregate_outstanding(cheques) == Decimal("10500.50")
