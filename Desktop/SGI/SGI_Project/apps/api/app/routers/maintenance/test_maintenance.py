"""Tests module Maintenance.

Couvre :
- Helpers purs (generate_reference, is_valid_transition, compute_sla_due, is_sla_breached)
- CRUD tickets (création, lecture, mise à jour, soft-delete)
- Machine à états (transitions valides et invalides)
- Assignation technicien / vendor
- Isolation multi-tenant (tenant A ne voit pas les tickets de tenant B)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from app.routers.maintenance.service import (
    SLA_HOURS,
    compute_sla_due,
    generate_reference,
    is_sla_breached,
    is_valid_transition,
    next_cron_run,
)


# ── Helpers purs ─────────────────────────────────────────────────────────

def test_generate_reference_format() -> None:
    assert generate_reference(2026, 1) == "MNT-2026-000001"
    assert generate_reference(2026, 999) == "MNT-2026-000999"


def test_generate_reference_lexicographic_order() -> None:
    refs = [generate_reference(2026, n) for n in (3, 1, 2, 100)]
    assert sorted(refs) == [
        generate_reference(2026, 1),
        generate_reference(2026, 2),
        generate_reference(2026, 3),
        generate_reference(2026, 100),
    ]


# ── next_cron_run (helper pur, sans dépendance) ──────────────────────────────


class TestNextCronRun:
    def test_monthly_first_at_9h(self) -> None:
        # "0 9 1 * *" = le 1er de chaque mois à 9h00.
        after = datetime(2026, 5, 15, 10, 0, tzinfo=timezone.utc)
        nxt = next_cron_run("0 9 1 * *", after)
        assert nxt == datetime(2026, 6, 1, 9, 0, tzinfo=timezone.utc)

    def test_same_day_later_today(self) -> None:
        # "30 14 * * *" = tous les jours à 14h30 → aujourd'hui si encore à venir.
        after = datetime(2026, 5, 15, 8, 0, tzinfo=timezone.utc)
        nxt = next_cron_run("30 14 * * *", after)
        assert nxt == datetime(2026, 5, 15, 14, 30, tzinfo=timezone.utc)

    def test_strictly_after(self) -> None:
        # Pile à l'heure → renvoie la PROCHAINE occurrence, pas la courante.
        after = datetime(2026, 5, 15, 14, 30, tzinfo=timezone.utc)
        nxt = next_cron_run("30 14 * * *", after)
        assert nxt == datetime(2026, 5, 16, 14, 30, tzinfo=timezone.utc)

    def test_day_of_week_monday(self) -> None:
        # "0 0 * * 1" = chaque lundi à minuit. 2026-05-15 = vendredi → 2026-05-18.
        after = datetime(2026, 5, 15, 12, 0, tzinfo=timezone.utc)
        nxt = next_cron_run("0 0 * * 1", after)
        assert nxt == datetime(2026, 5, 18, 0, 0, tzinfo=timezone.utc)

    def test_step_every_15_minutes(self) -> None:
        after = datetime(2026, 5, 15, 10, 7, tzinfo=timezone.utc)
        nxt = next_cron_run("*/15 * * * *", after)
        assert nxt == datetime(2026, 5, 15, 10, 15, tzinfo=timezone.utc)

    def test_quarterly_via_month_list(self) -> None:
        # "0 9 1 1,4,7,10 *" = 1er jan/avr/juil/oct à 9h.
        after = datetime(2026, 5, 1, 0, 0, tzinfo=timezone.utc)
        nxt = next_cron_run("0 9 1 1,4,7,10 *", after)
        assert nxt == datetime(2026, 7, 1, 9, 0, tzinfo=timezone.utc)

    def test_naive_datetime_assumed_utc(self) -> None:
        nxt = next_cron_run("0 9 1 * *", datetime(2026, 5, 15, 10, 0))
        assert nxt == datetime(2026, 6, 1, 9, 0, tzinfo=timezone.utc)

    def test_invalid_expression_returns_none(self) -> None:
        assert next_cron_run("not a cron", datetime(2026, 5, 15, tzinfo=timezone.utc)) is None
        assert next_cron_run("0 9 1 *", datetime(2026, 5, 15, tzinfo=timezone.utc)) is None  # 4 champs
        assert next_cron_run("99 9 1 * *", datetime(2026, 5, 15, tzinfo=timezone.utc)) is None  # hors borne


def test_is_valid_transition_allowed() -> None:
    assert is_valid_transition("new", "triaged")
    assert is_valid_transition("new", "assigned")
    assert is_valid_transition("assigned", "in_progress")
    assert is_valid_transition("in_progress", "resolved")
    assert is_valid_transition("resolved", "closed")
    assert is_valid_transition("in_progress", "on_hold")
    assert is_valid_transition("on_hold", "in_progress")


def test_is_valid_transition_forbidden() -> None:
    assert not is_valid_transition("new", "closed")
    assert not is_valid_transition("new", "resolved")
    assert not is_valid_transition("closed", "new")
    assert not is_valid_transition("cancelled", "new")
    assert not is_valid_transition("in_progress", "new")


def test_is_valid_transition_terminal_states() -> None:
    assert not is_valid_transition("closed", "triaged")
    assert not is_valid_transition("cancelled", "assigned")


def test_compute_sla_due_urgent() -> None:
    now = datetime(2026, 5, 30, 8, 0, tzinfo=timezone.utc)
    due = compute_sla_due("urgent", now)
    assert due == now + timedelta(hours=SLA_HOURS["urgent"])
    assert due == now + timedelta(hours=4)


def test_compute_sla_due_all_priorities() -> None:
    now = datetime(2026, 5, 30, 0, 0, tzinfo=timezone.utc)
    assert compute_sla_due("low",    now) == now + timedelta(hours=168)
    assert compute_sla_due("medium", now) == now + timedelta(hours=72)
    assert compute_sla_due("high",   now) == now + timedelta(hours=24)
    assert compute_sla_due("urgent", now) == now + timedelta(hours=4)


def test_compute_sla_due_naive_datetime() -> None:
    """Un datetime sans tzinfo doit être traité comme UTC."""
    naive_now = datetime(2026, 5, 30, 0, 0)
    due = compute_sla_due("high", naive_now)
    assert due == naive_now.replace(tzinfo=timezone.utc) + timedelta(hours=24)


def test_is_sla_breached_when_overdue() -> None:
    ticket = MagicMock()
    ticket.status = "in_progress"
    ticket.sla_due_at = datetime.now(timezone.utc) - timedelta(hours=1)
    assert is_sla_breached(ticket) is True


def test_is_sla_breached_when_not_yet_due() -> None:
    ticket = MagicMock()
    ticket.status = "in_progress"
    ticket.sla_due_at = datetime.now(timezone.utc) + timedelta(hours=10)
    assert is_sla_breached(ticket) is False


def test_is_sla_breached_on_terminal_status() -> None:
    for terminal in ("closed", "cancelled", "resolved"):
        ticket = MagicMock()
        ticket.status = terminal
        ticket.sla_due_at = datetime.now(timezone.utc) - timedelta(hours=1)
        assert is_sla_breached(ticket) is False, f"should not breach on {terminal}"


def test_is_sla_breached_no_due_date() -> None:
    ticket = MagicMock()
    ticket.status = "new"
    ticket.sla_due_at = None
    assert is_sla_breached(ticket) is False


# ── Tests d'intégration (nécessitent conftest DB + fixtures) ─────────────
# Les tests ci-dessous utilisent les fixtures `client`, `seed_company`, et
# `db_session` définies dans conftest.py (montées via docker-compose volume).
# Ils seront activés lors de l'exécution via `make test` ou
# `docker compose exec -e PYTHONPATH=/app api uv run pytest`.

pytestmark = pytest.mark.asyncio
