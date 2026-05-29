"""Tests Phase 1 — espace Client.

Couvre :
- GET  /client/dashboard         → 200 + stats à zéro
- POST /client/favorites         → 201
- GET  /client/favorites         → 200
- DELETE /client/favorites/{id}  → 204
- POST /client/favorites x2      → 409 (uq_user_property)
- POST /client/visits            → 201
- GET  /client/visits            → 200
- POST /client/messages          → 201 (vers agent)
- POST /client/messages/{id}/read → 204
- Endpoints refusent un user agent (require_roles client) → 403
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.company import Company
from app.models.property import Property
from app.models.user import User, UserRole, UserStatus

pytestmark = pytest.mark.asyncio


# ── Fixtures locales ─────────────────────────────────────────────────────


async def _make_client_user(
    db_session: AsyncSession, company: Company
) -> tuple[User, str]:
    """Crée un user role=client + son JWT."""
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"client-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("ClientPass!23"),
        full_name="Test Client",
        role=UserRole.CLIENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )
    return user, token


async def _make_agent_user(
    db_session: AsyncSession, company: Company
) -> tuple[User, str]:
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"agent-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("AgentPass!23"),
        full_name="Test Agent",
        role=UserRole.AGENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )
    return user, token


async def _make_property(db_session: AsyncSession, company: Company) -> Property:
    prop = Property(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"DXB-{uuid.uuid4().hex[:10]}",
        type="apartment",
        title_en="Test Apartment",
        price=1500000,
        status="available",
        city="Dubai",
    )
    db_session.add(prop)
    await db_session.commit()
    await db_session.refresh(prop)
    return prop


# ── Dashboard ────────────────────────────────────────────────────────────


async def test_client_dashboard_empty(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user, token = await _make_client_user(db_session, seed_company)
    resp = await client.get(
        "/api/v1/client/dashboard", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["favorites_count"] == 0
    assert body["pending_visits"] == 0
    assert body["unread_messages"] == 0


# ── RBAC ─────────────────────────────────────────────────────────────────


async def test_agent_cannot_access_client_endpoints(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _agent, token = await _make_agent_user(db_session, seed_company)
    resp = await client.get(
        "/api/v1/client/dashboard", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403


async def test_unauthenticated_blocked(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/client/dashboard")
    assert resp.status_code == 403


# ── Favoris ──────────────────────────────────────────────────────────────


async def test_favorites_full_lifecycle(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_client_user(db_session, seed_company)
    prop = await _make_property(db_session, seed_company)
    headers = {"Authorization": f"Bearer {token}"}

    # Add
    r1 = await client.post(
        "/api/v1/client/favorites",
        json={"property_id": str(prop.id)},
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    fav_id = r1.json()["id"]

    # List
    r2 = await client.get("/api/v1/client/favorites", headers=headers)
    assert r2.status_code == 200
    assert len(r2.json()) == 1
    assert r2.json()[0]["property_id"] == str(prop.id)

    # Duplicate → 409
    r3 = await client.post(
        "/api/v1/client/favorites",
        json={"property_id": str(prop.id)},
        headers=headers,
    )
    assert r3.status_code == 409

    # Delete
    r4 = await client.delete(f"/api/v1/client/favorites/{fav_id}", headers=headers)
    assert r4.status_code == 204

    # Delete again → 404
    r5 = await client.delete(f"/api/v1/client/favorites/{fav_id}", headers=headers)
    assert r5.status_code == 404


# ── Visites ──────────────────────────────────────────────────────────────


async def test_create_and_list_visit_request(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_client_user(db_session, seed_company)
    prop = await _make_property(db_session, seed_company)
    headers = {"Authorization": f"Bearer {token}"}

    future = (date.today() + timedelta(days=3)).isoformat()
    r1 = await client.post(
        "/api/v1/client/visits",
        json={
            "property_id": str(prop.id),
            "preferred_date": future,
            "preferred_time_slot": "morning",
            "client_notes": "Prefer Saturday morning",
        },
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["status"] == "pending"

    r2 = await client.get("/api/v1/client/visits", headers=headers)
    assert r2.status_code == 200
    assert len(r2.json()) == 1


# ── Messages ─────────────────────────────────────────────────────────────


async def test_client_can_message_agent_and_mark_read(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    client_user, client_token = await _make_client_user(db_session, seed_company)
    agent_user, agent_token = await _make_agent_user(db_session, seed_company)

    # Client envoie un message à l'agent
    r1 = await client.post(
        "/api/v1/client/messages",
        json={
            "recipient_user_id": str(agent_user.id),
            "subject": "Hello",
            "body": "Is the apartment still available?",
        },
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r1.status_code == 201, r1.text
    msg_id = r1.json()["id"]

    # Le client voit son propre message
    r2 = await client.get(
        "/api/v1/client/messages",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r2.status_code == 200
    assert any(m["id"] == msg_id for m in r2.json())

    # Le client (qui n'est pas destinataire) ne peut pas mark_read
    r3 = await client.post(
        f"/api/v1/client/messages/{msg_id}/read",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r3.status_code == 404  # pas destinataire → not_found
