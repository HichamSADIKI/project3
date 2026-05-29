"""Tests Inspections — helpers purs."""
from __future__ import annotations

import pytest

from app.routers.inspections.service import (
    compute_overall_score,
    generate_reference,
    is_valid_transition,
)


def test_generate_reference() -> None:
    assert generate_reference(2026, 1) == "INS-2026-000001"
    assert generate_reference(2026, 100) == "INS-2026-000100"


def test_generate_reference_sortable() -> None:
    refs = [generate_reference(2026, n) for n in (3, 1, 2)]
    assert sorted(refs) == [generate_reference(2026, 1), generate_reference(2026, 2), generate_reference(2026, 3)]


def test_valid_transitions() -> None:
    assert is_valid_transition("draft", "scheduled")
    assert is_valid_transition("draft", "in_progress")
    assert is_valid_transition("scheduled", "in_progress")
    assert is_valid_transition("in_progress", "completed")
    assert is_valid_transition("completed", "signed")
    assert is_valid_transition("completed", "in_progress")   # réouverture


def test_invalid_transitions() -> None:
    assert not is_valid_transition("signed", "in_progress")
    assert not is_valid_transition("cancelled", "draft")
    assert not is_valid_transition("draft", "completed")     # doit passer par in_progress
    assert not is_valid_transition("signed", "cancelled")


def test_compute_overall_score_normal() -> None:
    assert compute_overall_score([5, 4, 3]) == pytest.approx(4.0)
    assert compute_overall_score([5, 5, 5]) == pytest.approx(5.0)
    assert compute_overall_score([0, 0]) == pytest.approx(0.0)


def test_compute_overall_score_empty() -> None:
    assert compute_overall_score([]) is None


def test_compute_overall_score_with_none_filtered() -> None:
    """Les scores None sont ignorés dans le calcul."""
    # simulate : on passe seulement les scores non-None au helper
    scores = [s for s in [5, None, 3] if s is not None]
    assert compute_overall_score(scores) == pytest.approx(4.0)


pytestmark = pytest.mark.asyncio
