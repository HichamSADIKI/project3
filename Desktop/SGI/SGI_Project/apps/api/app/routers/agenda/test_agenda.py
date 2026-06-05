"""Tests Agenda — endpoints CRUD + isolation multi-tenant (Loi 1).

⚠️ Intégration (DB) : requièrent PostgreSQL. Lancer en conteneur :
    docker compose exec api uv run pytest app/routers/agenda/test_agenda.py
"""

from __future__ import annotations

from httpx import AsyncClient

from app.models.company import Company
from app.models.user import User

EVENT = {
    "title": "Visite Dubai Marina",
    "event_type": "visit",
    "start_at": "2026-07-01T10:00:00Z",
}


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_agenda_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/agenda")
    assert resp.status_code == 401


async def test_create_then_list(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.post("/api/v1/agenda", headers=_auth(token), json=EVENT)
    assert r.status_code == 201, r.text
    eid = r.json()["data"]["id"]
    lst = await client.get("/api/v1/agenda", headers=_auth(token))
    assert lst.status_code == 200
    body = lst.json()
    assert body["success"] is True
    assert any(e["id"] == eid for e in body["data"])


async def test_get_update_delete(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.post("/api/v1/agenda", headers=_auth(token), json=EVENT)
    eid = r.json()["data"]["id"]
    g = await client.get(f"/api/v1/agenda/{eid}", headers=_auth(token))
    assert g.status_code == 200
    p = await client.patch(f"/api/v1/agenda/{eid}", headers=_auth(token), json={"status": "done"})
    assert p.status_code == 200 and p.json()["data"]["status"] == "done"
    d = await client.delete(f"/api/v1/agenda/{eid}", headers=_auth(token))
    assert d.status_code == 204
    g2 = await client.get(f"/api/v1/agenda/{eid}", headers=_auth(token))
    assert g2.status_code == 404


async def test_invalid_type_422(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.post(
        "/api/v1/agenda", headers=_auth(token), json={**EVENT, "event_type": "bogus"}
    )
    assert r.status_code == 422


async def test_cross_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : un tenant ne voit pas les événements d'un autre (404 + absent de la liste)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    r = await client.post("/api/v1/agenda", headers=_auth(token_a), json=EVENT)
    eid = r.json()["data"]["id"]
    g = await client.get(f"/api/v1/agenda/{eid}", headers=_auth(token_b))
    assert g.status_code == 404
    lst = await client.get("/api/v1/agenda", headers=_auth(token_b))
    assert all(e["id"] != eid for e in lst.json()["data"])
