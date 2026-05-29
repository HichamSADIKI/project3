"""Tests IA — helpers purs de scoring/prédiction."""
from __future__ import annotations

import pytest

from app.routers.ai_services.service import (
    compute_risk_score,
    risk_level,
    suggest_preventive_frequency,
)


# ── compute_risk_score ─────────────────────────────────────────────────────

def test_risk_score_zero_tickets() -> None:
    assert compute_risk_score(0, 0, 0, 0) == 0


def test_risk_score_volume_capped() -> None:
    # 10 tickets → volume plafonné à 40 (pas 80).
    assert compute_risk_score(10, 0, 0, 10) == 40


def test_risk_score_full_signals() -> None:
    # 5 tickets (40) + 4 récurrences (30) + 2 breaches (30) = 100.
    assert compute_risk_score(5, 4, 2, 30) == 100


def test_risk_score_recurrence_component() -> None:
    # 2 tickets (16) + récurrence 3 (20) + 0 breach = 36.
    assert compute_risk_score(2, 3, 0, 30) == 36


def test_risk_score_old_history_amortized() -> None:
    # Historique > 1 an avec ≤ 2 tickets → amorti à 70%.
    base = compute_risk_score(1, 1, 1, 30)        # récent
    aged = compute_risk_score(1, 1, 1, 400)       # ancien
    assert aged < base


def test_risk_score_never_exceeds_100() -> None:
    assert compute_risk_score(100, 100, 100, 0) == 100


# ── risk_level ─────────────────────────────────────────────────────────────

def test_risk_levels() -> None:
    assert risk_level(0) == "low"
    assert risk_level(24) == "low"
    assert risk_level(25) == "medium"
    assert risk_level(49) == "medium"
    assert risk_level(50) == "high"
    assert risk_level(74) == "high"
    assert risk_level(75) == "critical"
    assert risk_level(100) == "critical"


# ── suggest_preventive_frequency ───────────────────────────────────────────

def test_suggest_freq_too_few_tickets() -> None:
    assert suggest_preventive_frequency("hvac", 1) is None


def test_suggest_freq_hvac_quarterly() -> None:
    assert suggest_preventive_frequency("hvac", 3) == "0 9 1 */3 *"


def test_suggest_freq_electrical_semester() -> None:
    assert suggest_preventive_frequency("electrical", 3) == "0 9 1 */6 *"


def test_suggest_freq_unknown_category_annual() -> None:
    assert suggest_preventive_frequency("other", 3) == "0 9 1 1 *"


pytestmark = pytest.mark.asyncio
