"""Tests refresh token — helpers purs + intégration endpoints.

Couvre :
- helpers purs : hash déterministe/64 car., token aléatoire, is_expired/is_active
- POST /auth/login          → renvoie access (court) + refresh (30 j)
- POST /auth/refresh        → rotation : nouvel access + nouveau refresh, ancien révoqué
- POST /auth/refresh (rejeu)→ 401 reuse_detected + révocation de toute la famille
- POST /auth/refresh        → 401 invalid_refresh (inconnu) / expired_refresh (périmé)
- POST /auth/logout         → révoque le refresh, idempotent (toujours 200)
- access issu du refresh utilisable sur un endpoint protégé (/auth/me)
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.core.config import settings
from app.models.company import Company
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole, UserStatus
from app.routers.auth.refresh_service import (
    generate_token,
    hash_token,
    is_active,
    is_expired,
    issue_refresh,
)

PASSWORD = "AdminPass!23"  # noqa: S105  faux mot de passe de test (= fixture seed_admin)


async def _make_login_user(db_session: AsyncSession, company: Company) -> User:
    """Crée un admin actif avec un email `@example.com` *valide* (le fixture
    seed_admin utilise `@sgi.test`, rejeté par EmailStr sur /login)."""
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"refresh-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password(PASSWORD),
        full_name="Refresh Tester",
        role=UserRole.ADMIN.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ─── Helpers purs (sans DB) ──────────────────────────────────────────────────


def test_hash_token_is_deterministic_and_64_hex() -> None:
    tok = generate_token()
    h = hash_token(tok)
    assert len(h) == 64
    assert hash_token(tok) == h  # déterministe → lookup possible
    assert all(c in "0123456789abcdef" for c in h)


def test_generate_token_is_random_and_not_the_hash() -> None:
    a, b = generate_token(), generate_token()
    assert a != b  # aléatoire
    assert len(a) >= 32
    assert hash_token(a) != a  # on ne stocke jamais le clair


def test_is_expired_and_is_active() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    fresh = RefreshToken(expires_at=now + timedelta(days=1), revoked_at=None)
    old = RefreshToken(expires_at=now - timedelta(seconds=1), revoked_at=None)
    revoked = RefreshToken(expires_at=now + timedelta(days=1), revoked_at=now)

    assert is_expired(old, now) is True
    assert is_expired(fresh, now) is False
    assert is_active(fresh, now) is True
    assert is_active(old, now) is False  # expiré
    assert is_active(revoked, now) is False  # révoqué


# ─── Intégration endpoints ───────────────────────────────────────────────────


async def _login(client: AsyncClient, email: str) -> dict:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_login_returns_access_and_refresh(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user = await _make_login_user(db_session, seed_company)
    body = await _login(client, user.email)
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["expires_in"] == settings.JWT_ACCESS_EXPIRE_HOURS * 3600
    assert body["refresh_expires_in"] == settings.JWT_REFRESH_EXPIRE_DAYS * 86400


async def test_refresh_rotates_and_old_is_reuse_detected(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user = await _make_login_user(db_session, seed_company)
    r1 = (await _login(client, user.email))["refresh_token"]

    # Rotation : nouvel access + nouveau refresh distinct de l'ancien.
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
    assert resp.status_code == 200, resp.text
    out = resp.json()
    r2 = out["refresh_token"]
    assert r2 and r2 != r1
    assert out["access_token"]

    # L'access fraîchement émis est exploitable sur un endpoint protégé.
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {out['access_token']}"}
    )
    assert me.status_code == 200, me.text
    assert me.json()["email"] == user.email

    # Rejeu de l'ANCIEN refresh → réutilisation détectée.
    replay = await client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
    assert replay.status_code == 401
    assert replay.json()["detail"] == "reuse_detected"

    # …et la détection a coupé TOUTE la famille : r2 (légitime) est révoqué aussi.
    r2_replay = await client.post("/api/v1/auth/refresh", json={"refresh_token": r2})
    assert r2_replay.status_code == 401


async def test_logout_revokes_refresh_and_is_idempotent(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user = await _make_login_user(db_session, seed_company)
    r = (await _login(client, user.email))["refresh_token"]

    out1 = await client.post("/api/v1/auth/logout", json={"refresh_token": r})
    assert out1.status_code == 200

    # Le refresh ne fonctionne plus après logout.
    after = await client.post("/api/v1/auth/refresh", json={"refresh_token": r})
    assert after.status_code == 401

    # Logout d'un token déjà révoqué/inconnu → toujours 200 (pas d'oracle).
    out2 = await client.post("/api/v1/auth/logout", json={"refresh_token": r})
    assert out2.status_code == 200


async def test_refresh_unknown_token_is_invalid(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": "definitely-not-a-real-token"}
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "invalid_refresh"


async def test_refresh_expired_token_rejected(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, _ = seed_admin
    rt, plain = await issue_refresh(db_session, admin.id)
    rt.expires_at = datetime.now(UTC) - timedelta(seconds=1)  # forcer l'expiration
    await db_session.commit()

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": plain})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "expired_refresh"
