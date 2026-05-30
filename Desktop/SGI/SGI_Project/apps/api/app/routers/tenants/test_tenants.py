"""Tests unitaires — helpers métier purs du module tenants."""
from datetime import date

import pytest

from app.routers.tenants.service import (
    compute_loyalty_score,
    is_kyc_complete,
    is_valid_kyc_transition,
    is_valid_transition,
    kyc_missing_documents,
    kyc_missing_identity_fields,
    valid_next_statuses,
    visa_alert_level,
)

# ─── is_valid_transition ───────────────────────────────────────────────────


class TestLifecycleTransitions:
    @pytest.mark.parametrize("current,target", [
        ("candidate", "active"),
        ("candidate", "former"),
        ("candidate", "blacklisted"),
        ("active", "former"),
        ("active", "blacklisted"),
        ("former", "active"),
        ("former", "blacklisted"),
    ])
    def test_valid_transitions(self, current: str, target: str) -> None:
        assert is_valid_transition(current, target) is True

    @pytest.mark.parametrize("current,target", [
        ("candidate", "candidate"),
        ("active", "candidate"),
        ("active", "active"),
        ("former", "candidate"),
        ("former", "former"),
        ("blacklisted", "active"),
        ("blacklisted", "former"),
        ("blacklisted", "candidate"),
        ("blacklisted", "blacklisted"),
    ])
    def test_invalid_transitions(self, current: str, target: str) -> None:
        assert is_valid_transition(current, target) is False

    def test_unknown_current_status_returns_false(self) -> None:
        assert is_valid_transition("nonexistent", "active") is False

    def test_blacklisted_is_terminal(self) -> None:
        assert valid_next_statuses("blacklisted") == set()


# ─── compute_loyalty_score ─────────────────────────────────────────────────


class TestLoyaltyScore:
    def test_baseline_is_50(self) -> None:
        assert compute_loyalty_score(0, 0, 0, 0, 0) == 50

    def test_perfect_short_tenant(self) -> None:
        # 12 paiements à temps, 1 an d'ancienneté → 50 + 24 + 5 = 79
        assert compute_loyalty_score(12, 0, 0, 0, 1.0) == 79

    def test_long_term_perfect_caps_anniversary_bonus_at_25(self) -> None:
        # 10 ans = +50 théorique, plafonné à +25
        score = compute_loyalty_score(0, 0, 0, 0, 10.0)
        assert score == 50 + 25

    def test_missed_payment_heavy_penalty(self) -> None:
        # 1 manqué = -15
        assert compute_loyalty_score(0, 0, 1, 0, 0) == 35

    def test_score_floor_is_zero(self) -> None:
        assert compute_loyalty_score(0, 0, 100, 100, 0) == 0

    def test_score_ceiling_is_100(self) -> None:
        # Très bon historique : 100 paiements + 10 ans
        score = compute_loyalty_score(100, 0, 0, 0, 10.0)
        assert score == 100

    def test_mixed_payments(self) -> None:
        # 10 à temps (+20), 2 en retard (-10), 0 manqués, 0 incident, 2 ans (+10)
        assert compute_loyalty_score(10, 2, 0, 0, 2.0) == 50 + 20 - 10 + 10


# ─── visa_alert_level ──────────────────────────────────────────────────────


class TestVisaAlertLevel:
    today = date(2026, 5, 28)

    def test_none_when_no_expiry(self) -> None:
        assert visa_alert_level(self.today, None) is None

    def test_expired(self) -> None:
        assert visa_alert_level(self.today, date(2026, 5, 20)) == "expired"

    def test_expires_today_is_critical_not_expired(self) -> None:
        assert visa_alert_level(self.today, date(2026, 5, 28)) == "critical"

    def test_critical_within_30_days(self) -> None:
        assert visa_alert_level(self.today, date(2026, 6, 15)) == "critical"

    def test_warning_within_90_days(self) -> None:
        assert visa_alert_level(self.today, date(2026, 8, 1)) == "warning"

    def test_no_alert_beyond_90_days(self) -> None:
        assert visa_alert_level(self.today, date(2027, 1, 1)) is None

    def test_boundary_31_days_is_warning(self) -> None:
        assert visa_alert_level(self.today, date(2026, 6, 28)) == "warning"

    def test_boundary_91_days_is_none(self) -> None:
        assert visa_alert_level(self.today, date(2026, 8, 27)) is None


class TestKycTransitions:
    @pytest.mark.parametrize("target", ["verified", "rejected"])
    def test_pending_can_resolve(self, target: str) -> None:
        assert is_valid_kyc_transition("pending", target) is True

    def test_not_started_to_pending(self) -> None:
        assert is_valid_kyc_transition("not_started", "pending") is True

    def test_rejected_can_resubmit(self) -> None:
        assert is_valid_kyc_transition("rejected", "pending") is True

    def test_verified_is_terminal(self) -> None:
        assert is_valid_kyc_transition("verified", "pending") is False
        assert is_valid_kyc_transition("verified", "rejected") is False

    def test_cannot_verify_without_pending(self) -> None:
        assert is_valid_kyc_transition("not_started", "verified") is False

    def test_unknown_state(self) -> None:
        assert is_valid_kyc_transition("bogus", "pending") is False


class TestKycMissing:
    def test_no_docs_missing_both(self) -> None:
        assert kyc_missing_documents(set()) == ["id", "passport"]

    def test_only_id_present(self) -> None:
        assert kyc_missing_documents({"id"}) == ["passport"]

    def test_all_present(self) -> None:
        assert kyc_missing_documents({"id", "passport", "other"}) == []

    def test_missing_identity_fields(self) -> None:
        missing = kyc_missing_identity_fields(
            emirates_id="784-...", passport_number=None, visa_number=None
        )
        assert missing == ["passport_number", "visa_number"]

    def test_no_missing_identity_fields(self) -> None:
        missing = kyc_missing_identity_fields(
            emirates_id="784", passport_number="P1", visa_number="V1"
        )
        assert missing == []


class TestIsKycComplete:
    today = date(2026, 5, 30)

    def _full_kwargs(self, **overrides):  # type: ignore[no-untyped-def]
        base = dict(
            present_doc_types={"id", "passport"},
            emirates_id="784",
            passport_number="P1",
            visa_number="V1",
            today=self.today,
            emirates_id_expiry=date(2027, 1, 1),
            passport_expiry=date(2028, 1, 1),
            visa_expiry=date(2027, 6, 1),
        )
        base.update(overrides)
        return base

    def test_complete_when_all_ok(self) -> None:
        assert is_kyc_complete(**self._full_kwargs()) is True

    def test_incomplete_missing_doc(self) -> None:
        assert is_kyc_complete(**self._full_kwargs(present_doc_types={"id"})) is False

    def test_incomplete_missing_field(self) -> None:
        assert is_kyc_complete(**self._full_kwargs(visa_number=None)) is False

    def test_incomplete_expired_document(self) -> None:
        # Passeport expiré → KYC incomplet.
        assert is_kyc_complete(**self._full_kwargs(passport_expiry=date(2025, 1, 1))) is False
