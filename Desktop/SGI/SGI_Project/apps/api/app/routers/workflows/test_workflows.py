"""Tests Workflow Engine — helpers purs."""
from __future__ import annotations

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.routers.workflows.service import (
    compute_step_sla,
    is_step_sla_breached,
    is_valid_instance_transition,
    is_valid_step_transition,
)


def test_valid_step_transitions() -> None:
    assert is_valid_step_transition("pending", "in_progress")
    assert is_valid_step_transition("in_progress", "approved")
    assert is_valid_step_transition("in_progress", "rejected")
    assert is_valid_step_transition("in_progress", "escalated")
    assert is_valid_step_transition("escalated", "in_progress")


def test_invalid_step_transitions() -> None:
    assert not is_valid_step_transition("approved", "rejected")
    assert not is_valid_step_transition("rejected", "approved")
    assert not is_valid_step_transition("pending", "approved")   # doit passer par in_progress


def test_valid_instance_transitions() -> None:
    assert is_valid_instance_transition("in_progress", "approved")
    assert is_valid_instance_transition("in_progress", "rejected")
    assert is_valid_instance_transition("in_progress", "cancelled")


def test_invalid_instance_transitions() -> None:
    assert not is_valid_instance_transition("approved", "rejected")
    assert not is_valid_instance_transition("cancelled", "in_progress")


def test_compute_step_sla_with_hours() -> None:
    now = datetime(2026, 5, 30, 10, 0, tzinfo=timezone.utc)
    due = compute_step_sla(24, now)
    assert due == now + timedelta(hours=24)


def test_compute_step_sla_none() -> None:
    now = datetime(2026, 5, 30, tzinfo=timezone.utc)
    assert compute_step_sla(None, now) is None
    assert compute_step_sla(0, now) is None


def test_step_sla_breached() -> None:
    step = MagicMock()
    step.status = "in_progress"
    step.sla_due_at = datetime.now(timezone.utc) - timedelta(hours=1)
    assert is_step_sla_breached(step) is True


def test_step_sla_not_breached() -> None:
    step = MagicMock()
    step.status = "in_progress"
    step.sla_due_at = datetime.now(timezone.utc) + timedelta(hours=5)
    assert is_step_sla_breached(step) is False


def test_step_sla_terminal_status() -> None:
    for terminal in ("approved", "rejected", "skipped", "escalated"):
        step = MagicMock()
        step.status = terminal
        step.sla_due_at = datetime.now(timezone.utc) - timedelta(hours=1)
        assert is_step_sla_breached(step) is False, terminal


pytestmark = pytest.mark.asyncio
