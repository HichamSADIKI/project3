"""Tests unitaires — transitions de statut Unit."""
import pytest

from app.routers.units.service import is_valid_status_transition


class TestUnitStatusTransitions:
    @pytest.mark.parametrize("current,target", [
        # Depuis vacant
        ("vacant", "reserved"),
        ("vacant", "occupied"),
        ("vacant", "maintenance"),
        ("vacant", "renovation"),
        ("vacant", "off_market"),
        # Depuis reserved
        ("reserved", "occupied"),
        ("reserved", "vacant"),
        # Depuis occupied
        ("occupied", "vacant"),
        ("occupied", "maintenance"),
        # Depuis maintenance
        ("maintenance", "vacant"),
        ("maintenance", "renovation"),
        # Depuis renovation
        ("renovation", "vacant"),
        ("renovation", "maintenance"),
        # Retour depuis off_market
        ("off_market", "vacant"),
    ])
    def test_valid_transitions(self, current: str, target: str) -> None:
        assert is_valid_status_transition(current, target) is True

    @pytest.mark.parametrize("current,target", [
        # Ne pas passer d'occupé directement à autre chose que vacant/maintenance
        ("occupied", "reserved"),
        ("occupied", "renovation"),
        ("occupied", "off_market"),
        # Reserved ne peut pas aller en maintenance directement
        ("reserved", "maintenance"),
        ("reserved", "renovation"),
        # off_market doit repasser par vacant
        ("off_market", "occupied"),
        ("off_market", "maintenance"),
        # Self-transitions invalides
        ("vacant", "vacant"),
        ("occupied", "occupied"),
    ])
    def test_invalid_transitions(self, current: str, target: str) -> None:
        assert is_valid_status_transition(current, target) is False

    def test_unknown_status(self) -> None:
        assert is_valid_status_transition("foo", "vacant") is False
