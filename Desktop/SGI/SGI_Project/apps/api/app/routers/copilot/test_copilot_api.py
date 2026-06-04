"""Tests d'intégration — API AI Copilot.

- `POST /copilot/assist` (sync) sur un ticket : enveloppe + champs d'assistance.
- 404 sur contexte inconnu / cross-tenant.
- `?push=true` → 202 (enqueue Celery, mocké pour ne pas dépendre du broker).
- RBAC (rôle client interdit) + anti-BOLA agent.
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.user import User, UserRole, UserStatus


async def _seed_agent(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    agent = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=f"agent-{uuid.uuid4().hex[:10]}@sgi.test",
        hashed_password=hash_password("AgentPass!23"),
        full_name="Copilot Agent",
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


async def _create_ticket(client: AsyncClient, token: str, *, subject: str = "Fuite d'eau") -> str:
    resp = await client.post(
        "/api/v1/tickets",
        json={"subject": subject, "priority": "high"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    return str(resp.json()["data"]["id"])


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/copilot/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "copilot"


async def test_assist_ticket_returns_payload(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    ticket_id = await _create_ticket(client, token, subject="Réclamation : panne urgente")
    resp = await client.post(
        "/api/v1/copilot/assist",
        json={"context_type": "ticket", "context_id": ticket_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["context_type"] == "ticket"
    assert data["sentiment"] in ("positive", "neutral", "negative")
    assert data["intent"]
    assert isinstance(data["next_best_actions"], list)
    assert data["suggested_reply"]
    assert data["summary"]


async def test_assist_unknown_returns_404(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    resp = await client.post(
        "/api/v1/copilot/assist",
        json={"context_type": "ticket", "context_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_assist_client_role_forbidden(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    ticket_id = await _create_ticket(client, token)
    resp = await client.post(
        "/api/v1/copilot/assist",
        json={"context_type": "ticket", "context_id": ticket_id},
        headers={"Authorization": f"Bearer {_client_token(admin)}"},
    )
    assert resp.status_code == 403


async def test_assist_cross_tenant_returns_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    _, token = seed_admin
    _, other_token = second_admin
    ticket_id = await _create_ticket(client, token)
    resp = await client.post(
        "/api/v1/copilot/assist",
        json={"context_type": "ticket", "context_id": ticket_id},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


async def test_assist_agent_anti_bola(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    cid = admin.company_id
    ticket_id = await _create_ticket(client, token)
    agent_id = await _seed_agent(db_session, cid)
    agent_headers = {"Authorization": f"Bearer {_agent_token(cid, agent_id)}"}

    # Ticket non assigné → l'agent ne peut pas l'assister (404).
    resp = await client.post(
        "/api/v1/copilot/assist",
        json={"context_type": "ticket", "context_id": ticket_id},
        headers=agent_headers,
    )
    assert resp.status_code == 404

    # Après attribution à l'agent → 200.
    await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"agent_user_id": str(agent_id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp2 = await client.post(
        "/api/v1/copilot/assist",
        json={"context_type": "ticket", "context_id": ticket_id},
        headers=agent_headers,
    )
    assert resp2.status_code == 200


# ── Assistant in-app (chat) ───────────────────────────────────────────────


async def test_chat_returns_reply_and_navigation(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    resp = await client.post(
        "/api/v1/copilot/chat",
        json={
            "messages": [{"role": "user", "content": "Comment créer un prospect dans le CRM ?"}],
            "locale": "fr",
            "screen": "dash",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["reply"]
    # Sans clé Gemini en test → repli déterministe.
    assert data["engine"] in ("fallback", "gemini-2.5-flash")
    screens = [n["screen"] for n in data["suggested_navigation"]]
    assert "crm" in screens


async def test_chat_data_question_reads_tenant_snapshot(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    # Tenant frais : compteurs à 0, mais la requête DB s'exécute réellement.
    resp = await client.post(
        "/api/v1/copilot/chat",
        json={
            "messages": [{"role": "user", "content": "Combien de prospects ai-je ?"}],
            "locale": "fr",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    reply = resp.json()["data"]["reply"]
    assert "prospects" in reply and "0" in reply


async def test_chat_snapshot_is_tenant_isolated(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
    db_session: AsyncSession,
) -> None:
    """Loi 1 : un bien semé chez le tenant A ne se voit pas dans le snapshot de B."""
    from decimal import Decimal

    from app.models.property import Property

    admin, token = seed_admin
    db_session.add(
        Property(
            id=uuid.uuid4(),
            company_id=admin.company_id,
            reference=f"REF-{uuid.uuid4().hex[:8]}",
            type="apartment",
            price=Decimal("1500000"),
            status="available",
        )
    )
    await db_session.commit()

    payload = {
        "messages": [{"role": "user", "content": "combien de biens disponibles ?"}],
        "locale": "fr",
    }
    # Tenant A voit son bien (>= 1).
    ra = await client.post(
        "/api/v1/copilot/chat", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert ra.status_code == 200, ra.text
    assert "biens disponibles" in ra.json()["data"]["reply"]

    # Tenant B : isolé → 0 bien disponible.
    _, other_token = second_admin
    rb = await client.post(
        "/api/v1/copilot/chat", json=payload, headers={"Authorization": f"Bearer {other_token}"}
    )
    assert rb.status_code == 200, rb.text
    assert "0 biens disponibles" in rb.json()["data"]["reply"]


async def test_chat_client_role_forbidden(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    resp = await client.post(
        "/api/v1/copilot/chat",
        json={"messages": [{"role": "user", "content": "salut"}], "locale": "fr"},
        headers={"Authorization": f"Bearer {_client_token(admin)}"},
    )
    assert resp.status_code == 403


async def test_chat_rejects_empty_messages(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    resp = await client.post(
        "/api/v1/copilot/chat",
        json={"messages": [], "locale": "fr"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_chat_stream_sse_fallback(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    """Sans clé Gemini (tests) : le flux SSE émet un delta heuristique + done."""
    _, token = seed_admin
    resp = await client.post(
        "/api/v1/copilot/chat/stream",
        json={
            "messages": [{"role": "user", "content": "Comment créer un prospect ?"}],
            "locale": "fr",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert "text/event-stream" in resp.headers.get("content-type", "")
    body = resp.text
    assert '"delta"' in body
    assert '"done"' in body
    assert '"engine": "fallback"' in body
    # Navigation déterministe présente dans l'événement final.
    assert '"crm"' in body


async def test_chat_stream_client_role_forbidden(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    resp = await client.post(
        "/api/v1/copilot/chat/stream",
        json={"messages": [{"role": "user", "content": "salut"}], "locale": "fr"},
        headers={"Authorization": f"Bearer {_client_token(admin)}"},
    )
    assert resp.status_code == 403
