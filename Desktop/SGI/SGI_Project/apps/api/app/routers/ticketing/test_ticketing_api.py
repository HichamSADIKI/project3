"""Tests d'intégration — API REST Ticketing SLA (Ph2).

Couvre :
- CRUD HTTP : create, liste paginée + filtres, détail (ticket + timeline),
  assign, transition de statut, commentaire.
- Isolation multi-tenant (Loi 1) : un tenant ne voit/touche jamais le ticket
  d'un autre (404 / liste vide).
- 409 sur transition de statut invalide (machine à états du service).
- Anti-BOLA agent : un simple agent ne voit/touche que SES tickets assignés ;
  self-assign sans corps ; refus d'attribuer à autrui (403) ou cross-tenant (400).
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.client import Client
from app.models.user import User, UserRole, UserStatus


async def _seed_client(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    """Crée un Client du tenant — `requester_client_id` a une FK vers `clients`."""
    c = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name="Demandeur",
        last_name="Test",
    )
    db.add(c)
    await db.commit()
    return c.id


async def _seed_agent(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    """Crée un vrai User (rôle agent) du tenant — `assigned_agent_id` a une FK
    vers `users`, donc un UUID inventé violerait la contrainte."""
    agent = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=f"agent-{uuid.uuid4().hex[:10]}@sgi.test",
        hashed_password=hash_password("AgentPass!23"),
        full_name="Ticketing Agent",
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


async def _create_ticket(
    client: AsyncClient,
    token: str,
    *,
    subject: str = "Climatisation en panne",
    priority: str = "high",
) -> str:
    resp = await client.post(
        "/api/v1/tickets",
        json={"subject": subject, "priority": priority},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    ticket_id: str = resp.json()["data"]["id"]
    return ticket_id


# ── Create + détail ──────────────────────────────────────────────────────────


async def test_create_ticket(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    admin, token = seed_admin
    resp = await client.post(
        "/api/v1/tickets",
        json={"subject": "Fuite plomberie", "priority": "urgent", "category": "maintenance"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "open"
    assert data["priority"] == "urgent"
    assert data["reference"].startswith("TCK-")
    assert data["sla_due_at"] is not None


async def test_get_ticket_detail_includes_timeline(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    ticket_id = await _create_ticket(client, token)

    resp = await client.get(f"/api/v1/tickets/{ticket_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == ticket_id
    # L'événement "created" est dans la timeline.
    assert len(data["events"]) == 1
    assert data["events"][0]["event_type"] == "created"


# ── Liste paginée + filtres ──────────────────────────────────────────────────


async def test_list_tickets_paginated_and_filtered(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    await _create_ticket(client, token, subject="A", priority="high")
    await _create_ticket(client, token, subject="B", priority="low")

    resp = await client.get("/api/v1/tickets", headers=headers)
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    assert payload["meta"]["total"] == 2
    assert payload["meta"]["page"] == 1

    resp2 = await client.get("/api/v1/tickets", params={"priority": "low"}, headers=headers)
    assert resp2.json()["meta"]["total"] == 1
    assert resp2.json()["data"][0]["priority"] == "low"


# ── Assign / transition / commentaire ────────────────────────────────────────


async def test_assign_then_transition(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    ticket_id = await _create_ticket(client, token)

    assigned = await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"agent_user_id": str(admin.id)},
        headers=headers,
    )
    assert assigned.status_code == 200
    # L'attribution depuis "open" bascule en "in_progress" (service Ph0-1).
    assert assigned.json()["data"]["status"] == "in_progress"
    assert assigned.json()["data"]["assigned_agent_id"] == str(admin.id)

    resolved = await client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"status": "resolved"},
        headers=headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["data"]["status"] == "resolved"
    assert resolved.json()["data"]["resolved_at"] is not None


async def test_transition_invalid_returns_409(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    ticket_id = await _create_ticket(client, token)

    # closed n'est pas accessible depuis resolved sans repasser… mais
    # open → pending puis pending → open est invalide ? Testons un cas sûr :
    # resolved d'abord, puis resolved → pending est interdit.
    await client.post(
        f"/api/v1/tickets/{ticket_id}/transition", json={"status": "resolved"}, headers=headers
    )
    resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"status": "pending"},
        headers=headers,
    )
    assert resp.status_code == 409
    assert "invalid_transition" in resp.json()["detail"]


async def test_add_comment_appears_in_timeline(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    ticket_id = await _create_ticket(client, token)

    resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/comments",
        json={"body": "Technicien dépêché sur site."},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["event_type"] == "commented"
    assert resp.json()["data"]["actor_user_id"] == str(admin.id)

    detail = await client.get(f"/api/v1/tickets/{ticket_id}", headers=headers)
    types = [e["event_type"] for e in detail.json()["data"]["events"]]
    assert "commented" in types


# ── Isolation multi-tenant (Loi 1) ──────────────────────────────────────────


async def test_get_ticket_cross_tenant_returns_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    _, token = seed_admin
    _, other_token = second_admin
    ticket_id = await _create_ticket(client, token)

    resp = await client.get(
        f"/api/v1/tickets/{ticket_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


async def test_list_tickets_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    _, token = seed_admin
    _, other_token = second_admin
    await _create_ticket(client, token)

    resp = await client.get("/api/v1/tickets", headers={"Authorization": f"Bearer {other_token}"})
    assert resp.status_code == 200
    assert resp.json()["meta"]["total"] == 0


async def test_transition_cross_tenant_returns_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    _, token = seed_admin
    _, other_token = second_admin
    ticket_id = await _create_ticket(client, token)

    resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"status": "in_progress"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


# ── Anti-BOLA agent ─────────────────────────────────────────────────────────


async def test_agent_only_sees_own_assigned_tickets(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    ticket_id = await _create_ticket(client, token)

    agent_uid = await _seed_agent(db_session, admin.company_id)
    agent_headers = {"Authorization": f"Bearer {_agent_token(admin.company_id, agent_uid)}"}

    # Non assigné → l'agent ne le voit pas.
    resp = await client.get("/api/v1/tickets", headers=agent_headers)
    assert resp.status_code == 200
    assert resp.json()["meta"]["total"] == 0

    # L'admin l'assigne à cet agent.
    await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"agent_user_id": str(agent_uid)},
        headers=headers,
    )

    resp2 = await client.get("/api/v1/tickets", headers=agent_headers)
    assert resp2.json()["meta"]["total"] == 1


async def test_agent_cannot_open_unassigned_ticket(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Anti-BOLA : un agent qui devine l'ID d'un ticket non assigné → 404."""
    admin, token = seed_admin
    ticket_id = await _create_ticket(client, token)

    agent_uid = await _seed_agent(db_session, admin.company_id)
    agent_headers = {"Authorization": f"Bearer {_agent_token(admin.company_id, agent_uid)}"}
    resp = await client.get(f"/api/v1/tickets/{ticket_id}", headers=agent_headers)
    assert resp.status_code == 404


async def test_agent_self_assign_without_body(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """« M'assigner » : un agent s'auto-attribue sans corps (agent_user_id omis)."""
    admin, token = seed_admin
    cid = admin.company_id
    agent_id = await _seed_agent(db_session, cid)
    ticket_id = await _create_ticket(client, token)
    resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={},
        headers={"Authorization": f"Bearer {_agent_token(cid, agent_id)}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["assigned_agent_id"] == str(agent_id)


async def test_agent_cannot_assign_to_other(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Un simple agent ne peut pas attribuer à quelqu'un d'autre (403)."""
    admin, token = seed_admin
    cid = admin.company_id
    agent_id = await _seed_agent(db_session, cid)
    other_id = await _seed_agent(db_session, cid)
    ticket_id = await _create_ticket(client, token)
    resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"agent_user_id": str(other_id)},
        headers={"Authorization": f"Bearer {_agent_token(cid, agent_id)}"},
    )
    assert resp.status_code == 403


async def test_assign_cross_tenant_agent_rejected(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
    db_session: AsyncSession,
) -> None:
    """Attribuer à un agent d'un AUTRE tenant → 400 (Loi 1)."""
    admin, token = seed_admin
    other_company, _ = second_admin
    foreign_agent = await _seed_agent(db_session, other_company.id)  # type: ignore[attr-defined]
    ticket_id = await _create_ticket(client, token)
    resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"agent_user_id": str(foreign_agent)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


async def test_create_with_valid_requester_client(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Un client demandeur du MÊME tenant est accepté (Loi 1 OK)."""
    admin, token = seed_admin
    client_id = await _seed_client(db_session, admin.company_id)
    resp = await client.post(
        "/api/v1/tickets",
        json={"subject": "Demande client", "requester_client_id": str(client_id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["requester_client_id"] == str(client_id)


async def test_create_with_cross_tenant_requester_client_rejected(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
    db_session: AsyncSession,
) -> None:
    """Loi 1 : référencer un client d'un AUTRE tenant → 400, pas de fuite cross-tenant."""
    admin, token = seed_admin
    other_company, _ = second_admin
    foreign_client = await _seed_client(db_session, other_company.id)  # type: ignore[attr-defined]
    resp = await client.post(
        "/api/v1/tickets",
        json={"subject": "Tentative cross-tenant", "requester_client_id": str(foreign_client)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "client_not_in_company"


async def test_assign_sets_first_response_at(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """L'assignation open→in_progress horodate la première réponse SLA."""
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    ticket_id = await _create_ticket(client, token)
    resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"agent_user_id": str(admin.id)},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["first_response_at"] is not None


async def test_agent_cannot_steal_ticket_assigned_to_other(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Anti-vol : un agent ne peut pas s'accaparer un ticket déjà attribué à un autre (409)."""
    admin, token = seed_admin
    cid = admin.company_id
    headers = {"Authorization": f"Bearer {token}"}
    agent_a = await _seed_agent(db_session, cid)
    agent_b = await _seed_agent(db_session, cid)
    ticket_id = await _create_ticket(client, token)

    # L'admin attribue le ticket à l'agent A.
    await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"agent_user_id": str(agent_a)},
        headers=headers,
    )
    # L'agent B (qui voit le ticket via son ID deviné) tente de se l'auto-attribuer.
    resp = await client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={},
        headers={"Authorization": f"Bearer {_agent_token(cid, agent_b)}"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "ticket_already_assigned"


async def test_client_role_forbidden_on_write(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    bad = {"Authorization": f"Bearer {_client_token(admin)}"}
    resp = await client.post(
        "/api/v1/tickets",
        json={"subject": "interdit"},
        headers=bad,
    )
    assert resp.status_code == 403
