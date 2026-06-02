"""Tests d'intégration — API REST Omnichannel Inbox (Ph2).

Couvre :
- CRUD HTTP : liste paginée + filtres, détail (messages/notes/tags), réponse
  sortante d'agent, assign, transition de statut, notes, tags.
- Isolation multi-tenant (Loi 1) : un tenant ne voit/touche jamais le fil d'un autre (404).
- 409 sur transition de statut invalide (machine à états du service).
- Anti-BOLA agent : un simple agent ne voit/touche que SES conversations assignées.

Les conversations entrantes n'ayant pas encore d'endpoint webhook (Ph3), on les
amorce via le service Ph0-1 sur `db_session`, en posant le GUC tenant requis par
la RLS pour l'écriture directe.
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.user import User, UserRole, UserStatus
from app.routers.inbox import service


async def _set_tenant(db: AsyncSession, company_id: uuid.UUID) -> None:
    await db.execute(
        sql_text("SELECT set_config('app.current_company_id', :cid, false)"),
        {"cid": str(company_id)},
    )


async def _seed_conversation(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    channel: str = "whatsapp",
    external_thread_id: str | None = None,
) -> uuid.UUID:
    """Amorce un fil entrant (1 message inbound) via le service Ph0-1."""
    await _set_tenant(db, company_id)
    thread = external_thread_id or f"wa-{uuid.uuid4().hex[:10]}"
    conv, _ = await service.get_or_create_conversation(
        db, company_id, channel=channel, external_thread_id=thread, contact_display="Client UAE"
    )
    await service.add_message(
        db, company_id, conv, direction="inbound", body="Salam", external_message_id=thread + "-m1"
    )
    return conv.id


async def _seed_agent(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    """Crée un vrai User (rôle agent) du tenant — `assigned_agent_id` a une FK
    vers `users`, donc un UUID inventé violerait la contrainte."""
    agent = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=f"agent-{uuid.uuid4().hex[:10]}@sgi.test",
        hashed_password=hash_password("AgentPass!23"),
        full_name="Inbox Agent",
        role=UserRole.AGENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(agent)
    await db.commit()
    return agent.id


def _agent_token(company_id: uuid.UUID, user_id: uuid.UUID) -> str:
    return encode_jwt(
        {
            "sub": str(user_id),
            "company_id": str(company_id),
            "role": "agent",
            "status": "active",
            "email": f"agent-{user_id}@test.local",
        }
    )


def _client_token(admin: User) -> str:
    return encode_jwt(
        {
            "sub": str(admin.id),
            "company_id": str(admin.company_id),
            "role": "client",
            "status": "active",
            "email": admin.email,
        }
    )


# ── Liste + détail ──────────────────────────────────────────────────────────


async def test_list_conversations_paginated_and_filtered(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    await _seed_conversation(db_session, admin.company_id, channel="whatsapp")
    await _seed_conversation(db_session, admin.company_id, channel="email")

    resp = await client.get("/api/v1/inbox/conversations", headers=headers)
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    assert payload["meta"]["total"] == 2
    assert payload["meta"]["page"] == 1

    # Filtre par canal.
    resp2 = await client.get(
        "/api/v1/inbox/conversations", params={"channel": "email"}, headers=headers
    )
    assert resp2.json()["meta"]["total"] == 1
    assert resp2.json()["data"][0]["channel"] == "email"


async def test_get_conversation_detail_includes_messages(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    conv_id = await _seed_conversation(db_session, admin.company_id)

    resp = await client.get(f"/api/v1/inbox/conversations/{conv_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == str(conv_id)
    assert len(data["messages"]) == 1
    assert data["messages"][0]["direction"] == "inbound"
    assert data["notes"] == []
    assert data["tags"] == []


# ── Réponse sortante ────────────────────────────────────────────────────────


async def test_post_outbound_message(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    conv_id = await _seed_conversation(db_session, admin.company_id)

    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/messages",
        json={"body": "Marhaba, comment puis-je aider ?"},
        headers=headers,
    )
    assert resp.status_code == 201
    msg = resp.json()["data"]
    assert msg["direction"] == "outbound"
    assert msg["sender_user_id"] == str(admin.id)


# ── Assign / status / notes / tags ──────────────────────────────────────────


async def test_assign_then_status_transition(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    conv_id = await _seed_conversation(db_session, admin.company_id)

    assigned = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/assign",
        json={"agent_user_id": str(admin.id)},
        headers=headers,
    )
    assert assigned.status_code == 200
    assert assigned.json()["data"]["status"] == "assigned"
    assert assigned.json()["data"]["assigned_agent_id"] == str(admin.id)

    resolved = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/status",
        json={"status": "resolved"},
        headers=headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["data"]["status"] == "resolved"


async def test_status_invalid_transition_returns_409(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    conv_id = await _seed_conversation(db_session, admin.company_id)

    # new → resolved est interdit par la machine à états.
    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/status",
        json={"status": "resolved"},
        headers=headers,
    )
    assert resp.status_code == 409
    assert "invalid_transition" in resp.json()["detail"]


async def test_add_note(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    conv_id = await _seed_conversation(db_session, admin.company_id)

    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/notes",
        json={"body": "Client VIP — rappeler avant 18h"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["agent_user_id"] == str(admin.id)

    detail = await client.get(f"/api/v1/inbox/conversations/{conv_id}", headers=headers)
    assert len(detail.json()["data"]["notes"]) == 1


async def test_create_list_and_attach_tag(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    conv_id = await _seed_conversation(db_session, admin.company_id)

    created = await client.post(
        "/api/v1/inbox/tags", json={"name": "Urgent", "color": "#f00"}, headers=headers
    )
    assert created.status_code == 201
    tag_id = created.json()["data"]["id"]

    listed = await client.get("/api/v1/inbox/tags", headers=headers)
    assert any(t["id"] == tag_id for t in listed.json()["data"])

    attached = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/tags",
        json={"tag_id": tag_id},
        headers=headers,
    )
    assert attached.status_code == 200

    detail = await client.get(f"/api/v1/inbox/conversations/{conv_id}", headers=headers)
    tags = detail.json()["data"]["tags"]
    assert len(tags) == 1 and tags[0]["name"] == "Urgent"


# ── Isolation multi-tenant (Loi 1) ──────────────────────────────────────────


async def test_get_conversation_cross_tenant_returns_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
    db_session: AsyncSession,
) -> None:
    admin, _ = seed_admin
    _, other_token = second_admin
    conv_id = await _seed_conversation(db_session, admin.company_id)

    resp = await client.get(
        f"/api/v1/inbox/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


async def test_list_conversations_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
    db_session: AsyncSession,
) -> None:
    admin, _ = seed_admin
    _, other_token = second_admin
    await _seed_conversation(db_session, admin.company_id)

    resp = await client.get(
        "/api/v1/inbox/conversations",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["meta"]["total"] == 0


async def test_post_message_cross_tenant_returns_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
    db_session: AsyncSession,
) -> None:
    admin, _ = seed_admin
    _, other_token = second_admin
    conv_id = await _seed_conversation(db_session, admin.company_id)

    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/messages",
        json={"body": "intrusion"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


async def test_attach_tag_cross_tenant_tag_returns_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
    db_session: AsyncSession,
) -> None:
    """Un tag du tenant B ne peut pas être attaché à un fil du tenant A."""
    admin, token = seed_admin
    _, other_token = second_admin
    conv_id = await _seed_conversation(db_session, admin.company_id)

    other_tag = await client.post(
        "/api/v1/inbox/tags",
        json={"name": "Externe"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    other_tag_id = other_tag.json()["data"]["id"]

    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/tags",
        json={"tag_id": other_tag_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ── Anti-BOLA agent ─────────────────────────────────────────────────────────


async def test_agent_only_sees_own_assigned_conversations(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    conv_id = await _seed_conversation(db_session, admin.company_id)

    agent_uid = await _seed_agent(db_session, admin.company_id)
    agent_headers = {"Authorization": f"Bearer {_agent_token(admin.company_id, agent_uid)}"}

    # Non assignée → l'agent ne la voit pas.
    resp = await client.get("/api/v1/inbox/conversations", headers=agent_headers)
    assert resp.status_code == 200
    assert resp.json()["meta"]["total"] == 0

    # L'admin l'assigne à cet agent.
    await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/assign",
        json={"agent_user_id": str(agent_uid)},
        headers=headers,
    )

    resp2 = await client.get("/api/v1/inbox/conversations", headers=agent_headers)
    assert resp2.json()["meta"]["total"] == 1


async def test_agent_cannot_open_unassigned_conversation(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Anti-BOLA : un agent qui devine l'ID d'un fil non assigné → 404."""
    admin, _ = seed_admin
    conv_id = await _seed_conversation(db_session, admin.company_id)

    agent_headers = {"Authorization": f"Bearer {_agent_token(admin.company_id, uuid.uuid4())}"}
    resp = await client.get(f"/api/v1/inbox/conversations/{conv_id}", headers=agent_headers)
    assert resp.status_code == 404


async def test_agent_cannot_assign(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """L'attribution est réservée aux admin/manager (403 pour un agent)."""
    admin, _ = seed_admin
    conv_id = await _seed_conversation(db_session, admin.company_id)
    agent_headers = {"Authorization": f"Bearer {_agent_token(admin.company_id, uuid.uuid4())}"}
    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/assign",
        json={"agent_user_id": str(uuid.uuid4())},
        headers=agent_headers,
    )
    assert resp.status_code == 403


async def test_client_role_forbidden_on_write(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, _ = seed_admin
    conv_id = await _seed_conversation(db_session, admin.company_id)
    bad = {"Authorization": f"Bearer {_client_token(admin)}"}
    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/messages",
        json={"body": "interdit"},
        headers=bad,
    )
    assert resp.status_code == 403


async def test_agent_self_assign_without_body(client: AsyncClient, seed_admin, db_session) -> None:
    """« M'assigner » : un agent s'auto-attribue sans corps (agent_user_id omis)."""
    admin, _ = seed_admin
    cid = admin.company_id
    agent_id = await _seed_agent(db_session, cid)
    conv_id = await _seed_conversation(db_session, cid)
    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/assign",
        json={},
        headers={"Authorization": f"Bearer {_agent_token(cid, agent_id)}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["assigned_agent_id"] == str(agent_id)


async def test_agent_cannot_assign_to_other(client: AsyncClient, seed_admin, db_session) -> None:
    """Un simple agent ne peut pas attribuer à quelqu'un d'autre (403)."""
    admin, _ = seed_admin
    cid = admin.company_id
    agent_id = await _seed_agent(db_session, cid)
    other_id = await _seed_agent(db_session, cid)
    conv_id = await _seed_conversation(db_session, cid)
    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/assign",
        json={"agent_user_id": str(other_id)},
        headers={"Authorization": f"Bearer {_agent_token(cid, agent_id)}"},
    )
    assert resp.status_code == 403


async def test_attach_tag_by_name_creates_tag(client: AsyncClient, seed_admin, db_session) -> None:
    """Attache par nom (saisie libre front) → tag créé-ou-récupéré puis attaché."""
    admin, token = seed_admin
    cid = admin.company_id
    conv_id = await _seed_conversation(db_session, cid)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        f"/api/v1/inbox/conversations/{conv_id}/tags",
        json={"name": "VIP"},
        headers=headers,
    )
    assert resp.status_code == 200
    # Le tag existe maintenant dans le catalogue du tenant.
    listed = await client.get("/api/v1/inbox/tags", headers=headers)
    assert any(t["name"] == "VIP" for t in listed.json()["data"])
