"""Tests Clients — CRUD, isolation multi-tenant (Loi 1), soft-delete, gardes de rôle.

Deux niveaux :
- **service** : appel direct des fonctions `service.py` avec `db_session` (couvre
  la logique métier : filtrage company_id, pagination, recherche, soft-delete).
- **router HTTP** : via le client `httpx` + JWT (couvre auth, gardes de rôle, 404).

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL` du conteneur.
Lancer avec : `docker compose exec api uv run pytest app/routers/clients/test_clients.py`.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.client import Client
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus
from app.routers.clients.schemas import ClientCreate, ClientUpdate
from app.routers.clients.service import (
    create_client,
    delete_client,
    get_client,
    list_clients,
    update_client,
)

pytestmark = pytest.mark.asyncio


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _make_company(db: AsyncSession) -> Company:
    """Crée une société de test (slug unique → pas de collision inter-tests)."""
    company = Company(
        id=uuid.uuid4(),
        name="Autre Société",
        slug=f"test-co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


async def _make_user(db: AsyncSession, company: Company, role: str) -> tuple[User, str]:
    """Crée un utilisateur actif d'un rôle donné + son JWT."""
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"{role}-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("Passw0rd!23"),
        full_name=f"Test {role}",
        role=role,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
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


def _individual(**overrides) -> ClientCreate:
    base = dict(type="individual", first_name="Sara", last_name="Khan")
    base.update(overrides)
    return ClientCreate(**base)


def _company_client(**overrides) -> ClientCreate:
    base = dict(type="company", company_name="Falcon FZE")
    base.update(overrides)
    return ClientCreate(**base)


# ── Service : create ───────────────────────────────────────────────────────


async def test_create_individual_persists_fields(
    db_session: AsyncSession, seed_company: Company
) -> None:
    client = await create_client(
        db_session,
        seed_company.id,
        _individual(email="sara@example.com", phone="+971500000001", source="crm"),
    )
    assert client.id is not None
    assert client.company_id == seed_company.id
    assert client.type == "individual"
    assert client.first_name == "Sara"
    assert client.email == "sara@example.com"
    assert client.deleted_at is None
    assert client.created_at is not None


async def test_create_company_client(db_session: AsyncSession, seed_company: Company) -> None:
    client = await create_client(db_session, seed_company.id, _company_client())
    assert client.type == "company"
    assert client.company_name == "Falcon FZE"


# ── Service : get + isolation tenant ─────────────────────────────────────────


async def test_get_returns_client_of_tenant(
    db_session: AsyncSession, seed_company: Company
) -> None:
    created = await create_client(db_session, seed_company.id, _individual())
    fetched = await get_client(db_session, seed_company.id, created.id)
    assert fetched is not None
    assert fetched.id == created.id


async def test_get_unknown_id_returns_none(db_session: AsyncSession, seed_company: Company) -> None:
    assert await get_client(db_session, seed_company.id, uuid.uuid4()) is None


async def test_get_cross_tenant_returns_none(
    db_session: AsyncSession, seed_company: Company
) -> None:
    """Loi 1 : un client de la société A est invisible pour la société B."""
    other = await _make_company(db_session)
    created = await create_client(db_session, seed_company.id, _individual())
    assert await get_client(db_session, other.id, created.id) is None


# ── Service : list (pagination, filtres, recherche, isolation) ───────────────


async def test_list_returns_only_tenant_clients(
    db_session: AsyncSession, seed_company: Company
) -> None:
    other = await _make_company(db_session)
    await create_client(db_session, seed_company.id, _individual(first_name="A"))
    await create_client(db_session, seed_company.id, _individual(first_name="B"))
    await create_client(db_session, other.id, _individual(first_name="Étranger"))

    clients, total = await list_clients(db_session, seed_company.id)
    assert total == 2
    assert {c.first_name for c in clients} == {"A", "B"}


async def test_list_filter_by_type(db_session: AsyncSession, seed_company: Company) -> None:
    await create_client(db_session, seed_company.id, _individual())
    await create_client(db_session, seed_company.id, _company_client())

    only_companies, total = await list_clients(db_session, seed_company.id, type_="company")
    assert total == 1
    assert only_companies[0].type == "company"


async def test_list_search_matches_name_and_email(
    db_session: AsyncSession, seed_company: Company
) -> None:
    await create_client(db_session, seed_company.id, _individual(first_name="Mohammed"))
    await create_client(
        db_session, seed_company.id, _individual(first_name="Yusuf", email="yusuf@x.io")
    )

    by_name, n1 = await list_clients(db_session, seed_company.id, q="moham")
    assert n1 == 1 and by_name[0].first_name == "Mohammed"

    by_email, n2 = await list_clients(db_session, seed_company.id, q="yusuf@x")
    assert n2 == 1 and by_email[0].email == "yusuf@x.io"


async def test_list_pagination(db_session: AsyncSession, seed_company: Company) -> None:
    for i in range(5):
        await create_client(db_session, seed_company.id, _individual(first_name=f"N{i}"))

    page1, total = await list_clients(db_session, seed_company.id, page=1, limit=2)
    page3, _ = await list_clients(db_session, seed_company.id, page=3, limit=2)
    assert total == 5
    assert len(page1) == 2
    assert len(page3) == 1  # 5 = 2 + 2 + 1


async def test_list_excludes_soft_deleted(db_session: AsyncSession, seed_company: Company) -> None:
    keep = await create_client(db_session, seed_company.id, _individual(first_name="Keep"))
    gone = await create_client(db_session, seed_company.id, _individual(first_name="Gone"))
    await delete_client(db_session, seed_company.id, gone.id)

    clients, total = await list_clients(db_session, seed_company.id)
    assert total == 1
    assert clients[0].id == keep.id


# ── Service : update ─────────────────────────────────────────────────────────


async def test_update_partial_only_sets_provided_fields(
    db_session: AsyncSession, seed_company: Company
) -> None:
    created = await create_client(
        db_session, seed_company.id, _individual(first_name="Old", phone="111")
    )
    updated = await update_client(
        db_session, seed_company.id, created.id, ClientUpdate(phone="222")
    )
    assert updated is not None
    assert updated.phone == "222"
    assert updated.first_name == "Old"  # non fourni → inchangé


async def test_update_unknown_returns_none(db_session: AsyncSession, seed_company: Company) -> None:
    assert (
        await update_client(db_session, seed_company.id, uuid.uuid4(), ClientUpdate(phone="x"))
        is None
    )


async def test_update_cross_tenant_returns_none(
    db_session: AsyncSession, seed_company: Company
) -> None:
    other = await _make_company(db_session)
    created = await create_client(db_session, seed_company.id, _individual())
    # La société B ne peut pas modifier le client de A.
    assert await update_client(db_session, other.id, created.id, ClientUpdate(phone="999")) is None
    # Et le client de A est intact.
    refetched = await get_client(db_session, seed_company.id, created.id)
    assert refetched is not None and refetched.phone != "999"


# ── Service : delete (soft-delete, jamais physique) ──────────────────────────


async def test_delete_is_soft(db_session: AsyncSession, seed_company: Company) -> None:
    created = await create_client(db_session, seed_company.id, _individual())
    ok = await delete_client(db_session, seed_company.id, created.id)
    assert ok is True

    # Invisible via l'accès tenant…
    assert await get_client(db_session, seed_company.id, created.id) is None
    # …mais toujours physiquement présent avec deleted_at posé.
    row = (await db_session.execute(select(Client).where(Client.id == created.id))).scalar_one()
    assert row.deleted_at is not None


async def test_delete_unknown_returns_false(
    db_session: AsyncSession, seed_company: Company
) -> None:
    assert await delete_client(db_session, seed_company.id, uuid.uuid4()) is False


async def test_delete_cross_tenant_returns_false(
    db_session: AsyncSession, seed_company: Company
) -> None:
    other = await _make_company(db_session)
    created = await create_client(db_session, seed_company.id, _individual())
    assert await delete_client(db_session, other.id, created.id) is False
    # Non supprimé côté A.
    assert await get_client(db_session, seed_company.id, created.id) is not None


# ── Router HTTP : auth, rôles, codes ─────────────────────────────────────────


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/clients/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "clients"


async def test_list_requires_tenant_context(client: AsyncClient) -> None:
    """Sans JWT, pas de contexte tenant → 401."""
    resp = await client.get("/api/v1/clients/")
    assert resp.status_code == 401


async def test_create_then_get_via_http(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}

    created = await client.post(
        "/api/v1/clients/",
        json={"type": "individual", "first_name": "Lina", "email": "lina@x.io"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    cid = created.json()["data"]["id"]

    got = await client.get(f"/api/v1/clients/{cid}", headers=headers)
    assert got.status_code == 200
    assert got.json()["data"]["first_name"] == "Lina"


async def test_get_unknown_returns_404(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _, token = seed_admin
    resp = await client.get(
        f"/api/v1/clients/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_create_forbidden_for_client_role(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """Un rôle `client` ne peut pas créer de fiche client (garde de rôle)."""
    _, token = await _make_user(db_session, seed_company, UserRole.CLIENT.value)
    resp = await client.post(
        "/api/v1/clients/",
        json={"type": "individual", "first_name": "X"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_delete_forbidden_for_agent_role(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """DELETE réservé à admin/manager — un agent est refusé (403)."""
    created = await create_client(db_session, seed_company.id, _individual())
    _, token = await _make_user(db_session, seed_company, UserRole.AGENT.value)
    resp = await client.delete(
        f"/api/v1/clients/{created.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_delete_via_http_returns_204(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    created = await create_client(db_session, admin.company_id, _individual())
    resp = await client.delete(
        f"/api/v1/clients/{created.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204
