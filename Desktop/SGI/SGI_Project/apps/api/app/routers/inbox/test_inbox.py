"""Tests Omnichannel Inbox (Ph0-1).

- Helpers purs : machine à états, référence, SLA, canaux.
- Service : get-or-create idempotent (webhook), dédup message, statut, assign,
  isolation multi-tenant (Loi 1).
"""

import uuid
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


# ─────────────────────────────────────────────────────────────────────────
# IA asynchrone : déclencheurs résumé / tags (send_task, anti-BOLA)
# ─────────────────────────────────────────────────────────────────────────


@pytest.fixture
def _capture_send_task(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, dict]]:
    """Capture les appels `celery_app.send_task` (pas de broker en test)."""
    calls: list[tuple[str, dict]] = []
    import app.tasks.celery_app as cel

    monkeypatch.setattr(cel.celery_app, "send_task", lambda name, **kw: calls.append((name, kw)))
    return calls


@pytest.mark.asyncio
async def test_summarize_enqueues_task_202(
    client: AsyncClient,
    seed_admin: tuple,
    db_session,
    _capture_send_task: list[tuple[str, dict]],
) -> None:
    admin, token = seed_admin
    conv, _ = await service.get_or_create_conversation(
        db_session, admin.company_id, channel="whatsapp", external_thread_id="t-summarize"
    )
    await db_session.commit()

    r = await client.post(
        f"/api/v1/inbox/conversations/{conv.id}/summarize",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 202
    assert r.json()["data"]["task"] == "summarize"
    assert _capture_send_task, "send_task non appelé"
    name, kw = _capture_send_task[0]
    assert name == "app.tasks.inbox.summarize_conversation"
    assert kw["queue"] == "exports"
    assert kw["args"] == [str(admin.company_id), str(conv.id)]


@pytest.mark.asyncio
async def test_suggest_tags_enqueues_task_202(
    client: AsyncClient,
    seed_admin: tuple,
    db_session,
    _capture_send_task: list[tuple[str, dict]],
) -> None:
    admin, token = seed_admin
    conv, _ = await service.get_or_create_conversation(
        db_session, admin.company_id, channel="whatsapp", external_thread_id="t-tags"
    )
    await db_session.commit()

    r = await client.post(
        f"/api/v1/inbox/conversations/{conv.id}/suggest-tags",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 202
    name, kw = _capture_send_task[0]
    assert name == "app.tasks.inbox.suggest_tags"
    assert kw["queue"] == "exports"


@pytest.mark.asyncio
async def test_summarize_cross_tenant_404(
    client: AsyncClient,
    seed_admin: tuple,
    second_admin: tuple,
    db_session,
    _capture_send_task: list[tuple[str, dict]],
) -> None:
    """Anti-BOLA Loi 1 : le tenant B ne peut pas résumer une conversation du tenant A."""
    admin, _ = seed_admin
    conv, _ = await service.get_or_create_conversation(
        db_session, admin.company_id, channel="whatsapp", external_thread_id="t-cross"
    )
    await db_session.commit()

    _, token2 = second_admin
    r = await client.post(
        f"/api/v1/inbox/conversations/{conv.id}/summarize",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert r.status_code == 404
    assert _capture_send_task == [], "aucune tâche ne doit être enfilée hors tenant"


@pytest.mark.asyncio
async def test_summarize_requires_auth(client: AsyncClient) -> None:
    r = await client.post(f"/api/v1/inbox/conversations/{uuid.uuid4()}/summarize")
    # Sans session : rejeté (middleware tenant 401 ou garde de rôle 403), jamais 202.
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_detail_surfaces_ai_result(
    client: AsyncClient,
    seed_admin: tuple,
    db_session,
) -> None:
    """Le détail expose ai_summary / ai_suggested_tags lus depuis channel_metadata."""
    admin, token = seed_admin
    conv, _ = await service.get_or_create_conversation(
        db_session, admin.company_id, channel="whatsapp", external_thread_id="t-ai-surface"
    )
    conv.channel_metadata = {
        "ai_summary": {"text": "Résumé du fil", "engine": "heuristic"},
        "ai_suggested_tags": {"tags": ["urgent", "vip"]},
    }
    await db_session.commit()

    r = await client.get(
        f"/api/v1/inbox/conversations/{conv.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["ai_summary"] == "Résumé du fil"
    assert data["ai_suggested_tags"] == ["urgent", "vip"]
