"""Tests de socle — Admin Console (Wave 0).

Gèle la FRONTIÈRE DE SÉCURITÉ dès le socle (avant le fan-out Wave 1) :
- App-admin (`/admin/users`, `/admin/audit`) : refus 403 sans rôle admin/manager.
- Infra-admin (`/admin/platform/*`) : 401 anonyme, 403 sans is_platform_admin,
  200 avec le drapeau super-admin.

Les agents Wave 1 ajoutent leurs tests dans `test_admin_{users,audit,infra,backups}.py`.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_health(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/admin/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "admin"


# ── App-admin (tenant, Loi 1) ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_appadmin_users_requires_role(client: AsyncClient) -> None:
    """Sans JWT (non authentifié) → 401 (garde require_admin)."""
    resp = await client.get("/api/v1/admin/users/health")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_appadmin_users_allows_admin(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get(
        "/api/v1/admin/users/health", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["section"] == "admin.users"


# ── Infra-admin (plateforme, cross-tenant) ───────────────────────────────────


@pytest.mark.asyncio
async def test_platform_infra_requires_auth(client: AsyncClient) -> None:
    """Anonyme → 401 (authentication_required)."""
    resp = await client.get("/api/v1/admin/platform/health")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_platform_infra_forbidden_for_plain_admin(client: AsyncClient, seed_admin) -> None:
    """Admin de société SANS is_platform_admin → 403 (platform_admin_required)."""
    _admin, token = seed_admin
    resp = await client.get(
        "/api/v1/admin/platform/health", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "platform_admin_required"


@pytest.mark.asyncio
async def test_platform_infra_allows_platform_admin(
    client: AsyncClient, seed_platform_admin
) -> None:
    _admin, token = seed_platform_admin
    resp = await client.get(
        "/api/v1/admin/platform/health", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_platform_backups_forbidden_for_plain_admin(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get(
        "/api/v1/admin/platform/backups/health", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403
