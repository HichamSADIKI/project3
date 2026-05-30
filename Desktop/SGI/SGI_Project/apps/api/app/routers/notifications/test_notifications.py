"""Tests unitaires — helpers purs des notifications (M6)."""

import pytest

from app.routers.notifications.service import (
    is_valid_channel,
    is_valid_status_transition,
)


class TestStatusTransition:
    @pytest.mark.parametrize("target", ["sent", "read"])
    def test_pending_can_advance(self, target: str) -> None:
        assert is_valid_status_transition("pending", target) is True

    def test_sent_to_read(self) -> None:
        assert is_valid_status_transition("sent", "read") is True

    def test_read_is_terminal(self) -> None:
        assert is_valid_status_transition("read", "sent") is False
        assert is_valid_status_transition("read", "pending") is False

    def test_no_backwards(self) -> None:
        assert is_valid_status_transition("sent", "pending") is False

    def test_unknown(self) -> None:
        assert is_valid_status_transition("bogus", "sent") is False


class TestChannel:
    @pytest.mark.parametrize("ch", ["in_app", "email", "whatsapp", "push"])
    def test_valid(self, ch: str) -> None:
        assert is_valid_channel(ch) is True

    @pytest.mark.parametrize("ch", ["sms", "", "fax"])
    def test_invalid(self, ch: str) -> None:
        assert is_valid_channel(ch) is False
