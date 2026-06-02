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


async def test_assist_push_returns_202(
    client: AsyncClient, seed_admin: tuple[User, str], monkeypatch
) -> None:
    """`?push=true` enqueue la tâche et renvoie 202 (broker mocké)."""
    _, token = seed_admin
    ticket_id = await _create_ticket(client, token)

    calls: list[tuple] = []

    class _FakeTask:
        def delay(self, *args, **kwargs) -> None:
            calls.append((args, kwargs))

    monkeypatch.setattr("app.tasks.copilot.assist_async", _FakeTask())
    resp = await client.post(
        "/api/v1/copilot/assist?push=true",
        json={"context_type": "ticket", "context_id": ticket_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200  # enveloppe AssistQueuedOut (success)
    assert resp.json()["data"]["status"] == "queued"
    assert len(calls) == 1


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
