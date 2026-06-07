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


# ─────────────────────────────────────────────────────────────────────────
# B3/B4 — config admin + validation de code + verrouillage serveur
# ─────────────────────────────────────────────────────────────────────────

_CONFIG = "/api/v1/admin/self-defense/config"
_VERIFY = "/api/v1/self-defense/verify"
_LOCKOUTS = "/api/v1/admin/self-defense/lockouts"


@pytest.mark.asyncio
async def test_config_put_get_never_leaks_hash(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.put(
        _CONFIG, headers=_auth(token), json={"arm_code": "abcd", "disarm_code": "efgh"}
    )
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert body["arm_code_set"] is True and body["disarm_code_set"] is True
    # Jamais le hash ni le code en clair dans la réponse.
    assert "abcd" not in str(body) and "hash" not in str(body)
    g = await client.get(_CONFIG, headers=_auth(token))
    assert g.json()["data"]["arm_code_set"] is True


@pytest.mark.asyncio
async def test_config_requires_admin_role(client: AsyncClient) -> None:
    assert (await client.get(_CONFIG)).status_code == 401  # non authentifié
    agent = encode_jwt(
        {
            "sub": str(uuid.uuid4()),
            "company_id": str(uuid.uuid4()),
            "role": "agent",
            "status": "active",
        }
    )
    assert (await client.get(_CONFIG, headers=_auth(agent))).status_code == 403  # rôle insuffisant


@pytest.mark.asyncio
async def test_config_cross_tenant_isolation(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple
) -> None:
    _admin_a, token_a = seed_admin
    _company_b, token_b = second_admin
    await client.put(_CONFIG, headers=_auth(token_a), json={"arm_code": "AAAA"})
    # B ne voit pas le code de A (sa propre config, vierge).
    g_b = await client.get(_CONFIG, headers=_auth(token_b))
    assert g_b.json()["data"]["arm_code_set"] is False


@pytest.mark.asyncio
async def test_verify_no_code_configured_allows(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.post(_VERIFY, headers=_auth(token), json={"purpose": "arm", "code": "x"})
    assert r.status_code == 200 and r.json()["ok"] is True  # non protégé tant qu'aucun code


@pytest.mark.asyncio
async def test_verify_correct_and_wrong(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    await client.put(_CONFIG, headers=_auth(token), json={"arm_code": "7777", "max_attempts": 3})

    ok = await client.post(_VERIFY, headers=_auth(token), json={"purpose": "arm", "code": "7777"})
    assert ok.json()["ok"] is True

    ko = await client.post(_VERIFY, headers=_auth(token), json={"purpose": "arm", "code": "0000"})
    assert ko.json()["ok"] is False and ko.json()["attempts_left"] < 3


@pytest.mark.asyncio
async def test_verify_arm_disarm_codes_are_distinct(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    await client.put(
        _CONFIG, headers=_auth(token), json={"arm_code": "AAAA", "disarm_code": "BBBB"}
    )
    # Le code armer ne désarme pas, et inversement.
    assert (
        await client.post(_VERIFY, headers=_auth(token), json={"purpose": "disarm", "code": "AAAA"})
    ).json()["ok"] is False
    assert (
        await client.post(_VERIFY, headers=_auth(token), json={"purpose": "disarm", "code": "BBBB"})
    ).json()["ok"] is True


@pytest.mark.asyncio
async def test_verify_lockout_then_admin_unlock(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    await client.put(_CONFIG, headers=_auth(token), json={"arm_code": "7777", "max_attempts": 3})

    for _ in range(3):
        await client.post(_VERIFY, headers=_auth(token), json={"purpose": "arm", "code": "bad"})

    # Verrouillé : même le bon code échoue.
    locked = await client.post(
        _VERIFY, headers=_auth(token), json={"purpose": "arm", "code": "7777"}
    )
    assert locked.json()["locked"] is True and locked.json()["ok"] is False

    # L'admin voit le verrouillage.
    lst = await client.get(_LOCKOUTS, headers=_auth(token))
    assert any(x["user_id"] == str(admin.id) for x in lst.json()["data"])

    # Déverrouillage → le bon code repasse.
    u = await client.post(
        f"/api/v1/admin/self-defense/lockouts/{admin.id}/unlock", headers=_auth(token)
    )
    assert u.status_code == 200
    again = await client.post(
        _VERIFY, headers=_auth(token), json={"purpose": "arm", "code": "7777"}
    )
    assert again.json()["ok"] is True


@pytest.mark.asyncio
async def test_verify_requires_auth(client: AsyncClient) -> None:
    assert (await client.post(_VERIFY, json={"purpose": "arm", "code": "x"})).status_code == 401


@pytest.mark.asyncio
async def test_status_reflects_config(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    s0 = await client.get("/api/v1/self-defense/status", headers=_auth(token))
    assert s0.status_code == 200
    assert s0.json()["arm_required"] is False and s0.json()["armgate_enabled"] is True
    await client.put(_CONFIG, headers=_auth(token), json={"arm_code": "7777"})
    s1 = await client.get("/api/v1/self-defense/status", headers=_auth(token))
    assert s1.json()["arm_required"] is True and s1.json()["disarm_required"] is False
