"""Tests Ticketing SLA (Ph0-1) — helpers purs + service (CRUD/transition/SLA)."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.routers.ticketing import service

# ── Helpers purs ────────────────────────────────────────────────────────────


def test_generate_reference() -> None:
    assert service.generate_reference(2026, 42) == "TCK-2026-000042"
    assert service.generate_reference(2026, 5) < service.generate_reference(2026, 50)


def test_transitions() -> None:
    assert service.is_valid_transition("open", "in_progress")
    assert service.is_valid_transition("in_progress", "resolved")
    assert service.is_valid_transition("resolved", "in_progress")  # réouverture
    assert not service.is_valid_transition("open", "open")
    assert not service.is_valid_transition("closed", "resolved")
    assert not service.is_valid_transition("x", "open")


def test_compute_sla_due_by_priority() -> None:
    base = datetime(2026, 6, 2, 8, 0, 0, tzinfo=UTC)
    assert service.compute_sla_due("urgent", base) == base + timedelta(minutes=60)
    assert service.compute_sla_due("low", base) == base + timedelta(minutes=2880)
    # priorité inconnue → défaut medium
    assert service.compute_sla_due("zzz", base) == base + timedelta(minutes=1440)


def test_is_sla_breached() -> None:
    now = datetime(2026, 6, 2, 12, 0, 0, tzinfo=UTC)
    past = now - timedelta(hours=1)
    future = now + timedelta(hours=1)
    assert service.is_sla_breached("open", past, now) is True
    assert service.is_sla_breached("open", future, now) is False
    # terminé → jamais en dépassement
    assert service.is_sla_breached("resolved", past, now) is False
    assert service.is_sla_breached("open", None, now) is False


def test_escalation_level_for() -> None:
    now = datetime(2026, 6, 2, 12, 0, 0, tzinfo=UTC)
    assert service.escalation_level_for(now + timedelta(hours=1), now) == 0
    assert service.escalation_level_for(now - timedelta(hours=2), now) == 1
    assert service.escalation_level_for(now - timedelta(hours=30), now) == 2
    assert service.escalation_level_for(None, now) == 0


# ── Service (DB) ──────────────────────────────────────────────────────────


async def test_create_ticket_sets_reference_and_sla(db_session, seed_company) -> None:
    cid = seed_company.id
    t = await service.create_ticket(db_session, cid, subject="Problème Ejari", priority="urgent")
    assert t.reference.startswith("TCK-")
    assert t.status == "open" and t.sla_due_at is not None
    # timeline : 1 event 'created'
    events = await service.list_events(db_session, cid, t.id)
    assert len(events) == 1 and events[0].event_type == "created"


async def test_transition_valid_and_invalid(db_session, seed_company) -> None:
    cid = seed_company.id
    t = await service.create_ticket(db_session, cid, subject="X")
    upd = await service.transition_ticket(db_session, cid, t.id, "in_progress")
    assert upd is not None and upd.status == "in_progress" and upd.first_response_at is not None
    with pytest.raises(ValueError, match="invalid_transition"):
        await service.transition_ticket(db_session, cid, t.id, "open")


async def test_assign_sets_agent_and_inprogress(db_session, seed_admin) -> None:
    admin, _ = seed_admin
    cid = admin.company_id
    t = await service.create_ticket(db_session, cid, subject="Y")
    a = await service.assign_ticket(db_session, cid, t.id, admin.id)
    assert a is not None and a.assigned_agent_id == admin.id and a.status == "in_progress"


async def test_list_tickets_tenant_isolation(db_session, seed_company) -> None:
    import uuid

    cid = seed_company.id
    await service.create_ticket(db_session, cid, subject="A")
    await service.create_ticket(db_session, cid, subject="B", priority="high")
    rows, total = await service.list_tickets(db_session, cid)
    assert total == 2
    hi, hi_total = await service.list_tickets(db_session, cid, priority="high")
    assert hi_total == 1
    _, other = await service.list_tickets(db_session, uuid.uuid4())
    assert other == 0


# ── HTTP ───────────────────────────────────────────────────────────────


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/tickets/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "ticketing"
