"""Tests Paiements — helpers purs."""
from __future__ import annotations

from datetime import date

import pytest

from app.routers.payments.service import generate_reference, is_overdue


def test_generate_reference() -> None:
    assert generate_reference(2026, 1) == "PAY-2026-000001"
    assert generate_reference(2026, 4242) == "PAY-2026-004242"


def test_generate_reference_sortable() -> None:
    refs = [generate_reference(2026, n) for n in (10, 2, 1)]
    assert sorted(refs) == [
        generate_reference(2026, 1),
        generate_reference(2026, 2),
        generate_reference(2026, 10),
    ]


def test_is_overdue_true() -> None:
    assert is_overdue(date(2026, 1, 1), "pending", date(2026, 5, 30)) is True


def test_is_overdue_not_due_yet() -> None:
    assert is_overdue(date(2026, 12, 31), "pending", date(2026, 5, 30)) is False


def test_is_overdue_already_paid() -> None:
    # Une demande payée n'est jamais en retard, même si due_date passée.
    assert is_overdue(date(2026, 1, 1), "paid", date(2026, 5, 30)) is False


def test_is_overdue_cancelled() -> None:
    assert is_overdue(date(2026, 1, 1), "cancelled", date(2026, 5, 30)) is False


pytestmark = pytest.mark.asyncio
