"""Tests — niveaux d'assurance « UAE PASS Infinity » (purs, sans DB)."""

from __future__ import annotations

from app.core.assurance import (
    VerificationState,
    assurance_level,
    can_perform,
    can_sign,
    level_at_least,
    min_level_for,
)


def _vs(**kw: bool) -> VerificationState:
    return VerificationState(**kw)


class TestAssuranceLevel:
    def test_l0_when_nothing(self) -> None:
        assert assurance_level(_vs()) == "L0"

    def test_l0_when_only_email(self) -> None:
        assert assurance_level(_vs(email_verified=True)) == "L0"

    def test_l1_email_and_mobile(self) -> None:
        assert assurance_level(_vs(email_verified=True, mobile_verified=True)) == "L1"

    def test_l2_with_emirates_id(self) -> None:
        s = _vs(email_verified=True, mobile_verified=True, emirates_id_verified=True)
        assert assurance_level(s) == "L2"

    def test_l3_with_strong_auth(self) -> None:
        s = _vs(
            email_verified=True,
            mobile_verified=True,
            emirates_id_verified=True,
            strong_auth_verified=True,
        )
        assert assurance_level(s) == "L3"

    def test_strong_auth_without_eid_does_not_reach_l2(self) -> None:
        # Contrôle renforcé sans Emirates ID → reste L1 (l'EID est requis pour L2/L3).
        s = _vs(email_verified=True, mobile_verified=True, strong_auth_verified=True)
        assert assurance_level(s) == "L1"


class TestLevelAtLeast:
    def test_ordering(self) -> None:
        assert level_at_least("L2", "L1") is True
        assert level_at_least("L1", "L1") is True
        assert level_at_least("L1", "L2") is False
        assert level_at_least("L3", "L0") is True

    def test_unknown_level_is_lowest(self) -> None:
        assert level_at_least("bogus", "L1") is False

    def test_unknown_minimum_denies(self) -> None:
        # Minimum inconnu → on n'autorise pas (fail‑safe).
        assert level_at_least("L3", "bogus") is False


class TestActionGating:
    def test_min_level_known_action(self) -> None:
        assert min_level_for("sign_document") == "L2"
        assert min_level_for("sign_qualified") == "L3"
        assert min_level_for("change_owner_iban") == "L3"

    def test_min_level_unknown_action_defaults_l1(self) -> None:
        assert min_level_for("some_random_action") == "L1"

    def test_can_perform(self) -> None:
        assert can_perform("L1", "login") is True
        assert can_perform("L1", "sign_document") is False
        assert can_perform("L2", "sign_document") is True
        assert can_perform("L2", "approve_payment") is False
        assert can_perform("L3", "approve_payment") is True


class TestCanSign:
    def test_advanced_needs_l2(self) -> None:
        assert can_sign("L1") is False
        assert can_sign("L2") is True
        assert can_sign("L3") is True

    def test_qualified_needs_l3(self) -> None:
        assert can_sign("L2", qualified=True) is False
        assert can_sign("L3", qualified=True) is True


class TestCapabilities:
    def test_l1_map(self) -> None:
        from app.core.assurance import ACTION_MIN_LEVEL, capabilities

        caps = capabilities("L1")
        # toutes les actions connues sont présentes avec leur seuil
        assert set(caps) == set(ACTION_MIN_LEVEL)
        assert caps["login"] == {"allowed": True, "required_level": "L1"}
        assert caps["sign_document"] == {"allowed": False, "required_level": "L2"}
        assert caps["approve_payment"]["allowed"] is False

    def test_l3_allows_everything(self) -> None:
        from app.core.assurance import capabilities

        caps = capabilities("L3")
        assert all(v["allowed"] for v in caps.values())
