"""Tests Omnichannel Inbox (Ph0-1).

- Helpers purs : machine à états, référence, SLA, canaux.
- Service : get-or-create idempotent (webhook), dédup message, statut, assign,
  isolation multi-tenant (Loi 1).
"""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.routers.inbox import service

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs
# ─────────────────────────────────────────────────────────────────────────


def test_status_transitions() -> None:
    assert service.is_valid_inbox_status_transition("new", "assigned")
    assert service.is_valid_inbox_status_transition("assigned", "resolved")
    assert service.is_valid_inbox_status_transition("resolved", "assigned")  # réouverture
    assert service.is_valid_inbox_status_transition("closed", "assigned")  # réouverture
    # invalides
    assert not service.is_valid_inbox_status_transition("new", "resolved")
    assert not service.is_valid_inbox_status_transition("assigned", "assigned")
    assert not service.is_valid_inbox_status_transition("unknown", "assigned")


def test_generate_inbox_reference() -> None:
    assert service.generate_inbox_reference(2026, 42) == "INBOX-2026-000042"
    assert service.generate_inbox_reference(2026, 7) < service.generate_inbox_reference(2026, 70)


def test_compute_response_due() -> None:
    base = datetime(2026, 6, 2, 10, 0, 0, tzinfo=UTC)
    due = service.compute_response_due(base, 30)
    assert due is not None and (due - base).total_seconds() == 1800
    assert service.compute_response_due(base, 0) is None


def test_is_valid_channel() -> None:
    assert service.is_valid_channel("whatsapp")
    assert not service.is_valid_channel("telegram")


# ─────────────────────────────────────────────────────────────────────────
# Service (DB)
# ─────────────────────────────────────────────────────────────────────────


async def test_get_or_create_conversation_idempotent(db_session, seed_company) -> None:
    cid = seed_company.id
    c1, created1 = await service.get_or_create_conversation(
        db_session, cid, channel="whatsapp", external_thread_id="wa-971500000000"
    )
    c2, created2 = await service.get_or_create_conversation(
        db_session, cid, channel="whatsapp", external_thread_id="wa-971500000000"
    )
    assert created1 is True and created2 is False
    assert c1.id == c2.id and c1.reference.startswith("INBOX-")


async def test_add_message_dedup_and_updates_last(db_session, seed_company) -> None:
    cid = seed_company.id
    conv, _ = await service.get_or_create_conversation(
        db_session, cid, channel="whatsapp", external_thread_id="wa-1"
    )
    m1, c1 = await service.add_message(
        db_session, cid, conv, direction="inbound", body="Salam", external_message_id="ext-1"
    )
    m2, c2 = await service.add_message(
        db_session, cid, conv, direction="inbound", body="Salam", external_message_id="ext-1"
    )
    assert c1 is True and c2 is False and m1.id == m2.id
    assert conv.last_message_at is not None


async def test_set_status_valid_and_invalid(db_session, seed_company) -> None:
    cid = seed_company.id
    conv, _ = await service.get_or_create_conversation(
        db_session, cid, channel="email", external_thread_id="em-1"
    )
    updated = await service.set_status(db_session, cid, conv.id, "assigned")
    assert updated is not None and updated.status == "assigned"
    with pytest.raises(ValueError, match="invalid_transition"):
        await service.set_status(db_session, cid, conv.id, "new")


async def test_assign_conversation_sets_agent_and_status(db_session, seed_admin) -> None:
    admin, _ = seed_admin
    cid = admin.company_id
    conv, _ = await service.get_or_create_conversation(
        db_session, cid, channel="webchat", external_thread_id="wc-1"
    )
    assigned = await service.assign_conversation(db_session, cid, conv.id, admin.id)
    assert assigned is not None
    assert assigned.assigned_agent_id == admin.id and assigned.status == "assigned"


async def test_list_conversations_tenant_isolation(db_session, seed_company) -> None:
    cid = seed_company.id
    await service.get_or_create_conversation(
        db_session, cid, channel="whatsapp", external_thread_id="wa-iso"
    )
    rows, total = await service.list_conversations(db_session, cid)
    assert total == 1 and len(rows) == 1
    # Autre tenant ne voit rien (Loi 1)
    import uuid

    other_rows, other_total = await service.list_conversations(db_session, uuid.uuid4())
    assert other_total == 0


# ── HTTP ───────────────────────────────────────────────────────────────


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/inbox/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "inbox"
