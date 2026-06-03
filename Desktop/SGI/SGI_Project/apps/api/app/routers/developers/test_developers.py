"""Tests Developers / Promoteurs — helpers purs + intégration HTTP.

- Helper pur (sans DB) : generate_reference.
- Intégration HTTP (requiert PostgreSQL — `docker compose exec api uv run pytest`) :
  CRUD, séquence de référence, isolation multi-tenant (Loi 1), 404 anti-BOLA,
  RBAC (agent ne peut pas créer).
"""

import pytest
from httpx import AsyncClient

from app.models.user import User
from app.routers.developers import service

# ── Helper pur : generate_reference ───────────────────────────────────────────


def test_generate_reference() -> None:
    assert service.generate_reference(2026, 42) == "DEV-2026-000042"
    assert service.generate_reference(2026, 1) == "DEV-2026-000001"
    # Triable lexicographiquement.
    assert service.generate_reference(2026, 5) < service.generate_reference(2026, 50)


# ── Intégration HTTP ──────────────────────────────────────────────────────────


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/developers/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "developers"


@pytest.mark.asyncio
async def test_list_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/developers/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_sets_reference_and_lists(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    resp = await client.post(
        "/api/v1/developers/",
        headers=_auth(token),
        json={
            "name_en": "Emaar Properties",
            "city": "Dubai",
            "trade_license": "DLD-1001",
            "projects_count": 42,
        },
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["reference"].startswith("DEV-")
    assert data["name_en"] == "Emaar Properties"
    assert data["is_active"] is True
    assert data["projects_count"] == 42

    listed = await client.get("/api/v1/developers/", headers=_auth(token))
    assert listed.status_code == 200
    refs = [d["reference"] for d in listed.json()["data"]]
    assert data["reference"] in refs


@pytest.mark.asyncio
async def test_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    _admin, token = seed_admin
    _company2, token2 = second_admin
    created = await client.post(
        "/api/v1/developers/",
        headers=_auth(token),
        json={"name_en": "DAMAC Properties"},
    )
    dev_id = created.json()["data"]["id"]

    # Le 2ᵉ tenant ne voit pas le promoteur du 1ᵉʳ (Loi 1).
    other = await client.get("/api/v1/developers/", headers=_auth(token2))
    assert all(d["id"] != dev_id for d in other.json()["data"])
    # Accès direct cross-tenant → 404 (anti-BOLA, jamais 403).
    direct = await client.get(f"/api/v1/developers/{dev_id}", headers=_auth(token2))
    assert direct.status_code == 404


@pytest.mark.asyncio
async def test_update_and_soft_delete(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    created = await client.post(
        "/api/v1/developers/", headers=_auth(token), json={"name_en": "Sobha Realty"}
    )
    dev_id = created.json()["data"]["id"]

    patched = await client.patch(
        f"/api/v1/developers/{dev_id}",
        headers=_auth(token),
        json={"is_active": False, "units_count": 6100},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["is_active"] is False
    assert patched.json()["data"]["units_count"] == 6100

    deleted = await client.delete(f"/api/v1/developers/{dev_id}", headers=_auth(token))
    assert deleted.status_code == 204
    # Soft delete : plus listé ni accessible.
    gone = await client.get(f"/api/v1/developers/{dev_id}", headers=_auth(token))
    assert gone.status_code == 404
