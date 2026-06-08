"""Tests — présence (modèle + géo-IP self-hosted).

⚠️ Intégration : PostgreSQL requis → `docker compose exec api uv run pytest
app/routers/presence/test_presence.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import geoip
from app.core.auth import encode_jwt
from app.models.user import User
from app.routers.presence.models import PresenceSession

# ── B2 : géo-IP (purs, sans DB ni réseau) ────────────────────────────────────


def test_geoip_resolve_none_is_empty() -> None:
    assert geoip.resolve(None) == {"country": None, "city": None, "lat": None, "lng": None}


def test_geoip_resolve_without_db_is_safe() -> None:
    # Aucune base GeoLite2 en test → dégradation gracieuse, jamais d'exception.
    r = geoip.resolve("8.8.8.8")
    assert r["lat"] is None and r["lng"] is None and r["country"] is None


# ── B1 : modèle presence_session ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_presence_session_persists(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _token = seed_admin
    db_session.add(
        PresenceSession(
            company_id=admin.company_id,
            user_id=admin.id,
            session_key="sess-1",
            ip="10.0.0.1",
            category="realestate",
            subcategory="rentals",
            page="realestate_location",
            last_seen_at=datetime.now(UTC),
        )
    )
    await db_session.commit()

    got = (
        await db_session.execute(
            select(PresenceSession).where(
                PresenceSession.company_id == admin.company_id,
                PresenceSession.session_key == "sess-1",
            )
        )
    ).scalar_one()
    assert got.category == "realestate"
    assert got.page == "realestate_location"
    assert got.geo_lat is None  # pas de géoloc en test


# ── B3 : agrégation pure ──────────────────────────────────────────────────


def test_count_by_groups_and_sorts() -> None:
    from app.routers.presence.service import count_by

    res = count_by([("a", "A"), ("a", None), ("b", "B"), (None, None)])
    by = {r["key"]: r["count"] for r in res}
    assert by == {"a": 2, "b": 1, "∅": 1}
    assert res[0]["count"] >= res[-1]["count"]  # tri décroissant
    assert next(r for r in res if r["key"] == "a")["label"] == "A"


# ── B4 : heartbeat + sessions actives (HTTP) ─────────────────────────────────


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_heartbeat_then_active(client, seed_admin: tuple[User, str]) -> None:  # noqa: ANN001
    admin, token = seed_admin
    hb = await client.post(
        "/api/v1/presence/heartbeat",
        headers=_auth(token),
        json={"session_key": "sess-aaaa", "category": "realestate", "page": "realestate_units"},
    )
    assert hb.status_code == 200, hb.text

    res = await client.get("/api/v1/presence/active?advanced=1", headers=_auth(token))
    assert res.status_code == 200
    body = res.json()
    assert any(s["user_id"] == str(admin.id) for s in body["sessions"])
    assert body["advanced"] is not None
    assert any(b["key"] == "realestate" for b in body["advanced"]["by_category"])


@pytest.mark.asyncio
async def test_active_requires_admin(client, seed_admin: tuple[User, str]) -> None:  # noqa: ANN001
    import uuid as _uuid

    assert (await client.get("/api/v1/presence/active")).status_code == 401
    agent = encode_jwt(
        {
            "sub": str(_uuid.uuid4()),
            "company_id": str(_uuid.uuid4()),
            "role": "agent",
            "status": "active",
        }
    )
    assert (await client.get("/api/v1/presence/active", headers=_auth(agent))).status_code == 403


@pytest.mark.asyncio
async def test_active_cross_tenant_isolation(
    client, seed_admin: tuple[User, str], second_admin: tuple
) -> None:  # noqa: ANN001
    admin_a, token_a = seed_admin
    _company_b, token_b = second_admin
    await client.post(
        "/api/v1/presence/heartbeat", headers=_auth(token_a), json={"session_key": "sess-a-only"}
    )
    res_b = await client.get("/api/v1/presence/active", headers=_auth(token_b))
    assert all(s["user_id"] != str(admin_a.id) for s in res_b.json()["sessions"])
