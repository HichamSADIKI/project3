"""Tests — self_defense (trace d'événements du panneau UX → audit_logs).

⚠️ Intégration : PostgreSQL requis → `docker compose exec api uv run pytest
app/routers/self_defense/test_self_defense.py`.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt
from app.models.audit_log import AuditLog
from app.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_event_persists_audit(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    r = await client.post(
        "/api/v1/self-defense/event",
        headers=_auth(token),
        json={"action": "mode_radar", "mode": "radar"},
    )
    assert r.status_code == 200, r.text

    rows = (
        (
            await db_session.execute(
                select(AuditLog).where(
                    AuditLog.company_id == admin.company_id,
                    AuditLog.action == "self_defense:mode_radar",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1
    assert rows[0].resource == "self_defense"
    assert rows[0].changes.get("mode") == "radar"
    assert rows[0].user_email == admin.email


@pytest.mark.asyncio
async def test_event_requires_auth(client: AsyncClient) -> None:
    assert (
        await client.post("/api/v1/self-defense/event", json={"action": "arm"})
    ).status_code == 401


@pytest.mark.asyncio
async def test_event_rejects_invalid_action(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.post(
        "/api/v1/self-defense/event", headers=_auth(token), json={"action": "hack"}
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_event_never_stores_validation_code(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    # Même si un 'code' est envoyé par erreur, le schéma l'ignore (jamais stocké).
    admin, token = seed_admin
    r = await client.post(
        "/api/v1/self-defense/event",
        headers=_auth(token),
        json={"action": "code_fail", "mode": "dome", "code": "123"},
    )
    assert r.status_code == 200
    rows = (
        (
            await db_session.execute(
                select(AuditLog).where(
                    AuditLog.company_id == admin.company_id,
                    AuditLog.action == "self_defense:code_fail",
                )
            )
        )
        .scalars()
        .all()
    )
    assert rows, "événement non tracé"
    for row in rows:
        assert "123" not in str(row.changes)  # aucun secret stocké


@pytest.mark.asyncio
async def test_event_malformed_company_id_is_401(client: AsyncClient) -> None:
    tok = encode_jwt(
        {"sub": str(uuid.uuid4()), "company_id": "not-a-uuid", "role": "admin", "status": "active"}
    )
    r = await client.post("/api/v1/self-defense/event", headers=_auth(tok), json={"action": "arm"})
    assert r.status_code == 401
