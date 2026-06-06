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
    clients_segmentation,
    create_client,
    delete_client,
    get_client,
    list_clients,
    summarize_clients,
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


# ── Export CSV ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_export_csv_returns_tenant_clients(
    client: AsyncClient,
    seed_admin: tuple,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """L'export CSV renvoie un fichier attaché avec en-tête + lignes du tenant."""
    _, token = seed_admin
    await create_client(db_session, seed_company.id, _individual(first_name="Aymane"))
    await db_session.commit()

    r = await client.get("/api/v1/clients/export.csv", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "attachment" in r.headers.get("content-disposition", "")
    body = r.text
    lines = body.strip().splitlines()
    assert lines[0].startswith("id,type,first_name")  # en-tête
    assert "Aymane" in body


@pytest.mark.asyncio
async def test_export_csv_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple,
    second_admin: tuple,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Loi 1 : l'export d'un tenant ne contient jamais les clients d'un autre."""
    await create_client(db_session, seed_company.id, _individual(first_name="SecretName"))
    await db_session.commit()

    _, token2 = second_admin
    r = await client.get(
        "/api/v1/clients/export.csv", headers={"Authorization": f"Bearer {token2}"}
    )
    assert r.status_code == 200
    assert "SecretName" not in r.text


@pytest.mark.asyncio
async def test_export_csv_sanitizes_formula_injection(
    client: AsyncClient,
    seed_admin: tuple,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Injection de formule CSV neutralisée : cellule dangereuse préfixée d'une apostrophe."""
    _, token = seed_admin
    await create_client(db_session, seed_company.id, _individual(first_name="=cmd|calc"))
    await db_session.commit()

    r = await client.get("/api/v1/clients/export.csv", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert "'=cmd|calc" in r.text  # préfixée
    assert ",=cmd|calc" not in r.text  # jamais une formule brute en début de cellule


# ── Segmentation du portefeuille ─────────────────────────────────────────────

from decimal import Decimal as _Decimal  # noqa: E402
from types import SimpleNamespace  # noqa: E402


async def test_summarize_clients_pure() -> None:
    clients = [
        SimpleNamespace(type="individual", source="crm", budget_max=_Decimal("2500000")),
        SimpleNamespace(type="individual", source="website", budget_max=_Decimal("500000")),
        SimpleNamespace(type="company", source="crm", budget_max=None),
        SimpleNamespace(type="individual", source=None, budget_max=_Decimal("2000000")),
    ]
    s = summarize_clients(clients)
    assert s["total"] == 4
    assert s["by_type"] == {"individual": 3, "company": 1}
    assert s["by_source"]["crm"] == 2
    assert s["by_source"]["unknown"] == 1
    # budget_max >= 2 000 000 → 2 clients (2.5M et 2.0M pile)
    assert s["golden_visa_budget_count"] == 2


async def _mk_client(db, company_id, **kw):
    base = dict(type="individual", first_name="X", last_name="Y")
    base.update(kw)
    return await create_client(db, company_id, ClientCreate(**base))


async def test_clients_segmentation_service(
    db_session: AsyncSession, seed_company: Company
) -> None:
    await _mk_client(db_session, seed_company.id, source="crm", budget_max=_Decimal("3000000"))
    await _mk_client(db_session, seed_company.id, source="website", budget_max=_Decimal("400000"))
    await _mk_client(db_session, seed_company.id, type="company", company_name="ACME", source="crm")
    s = await clients_segmentation(db_session, seed_company.id)
    assert s["total"] == 3
    assert s["by_type"]["individual"] == 2
    assert s["by_type"]["company"] == 1
    assert s["by_source"]["crm"] == 2
    assert s["golden_visa_budget_count"] == 1


async def test_clients_segmentation_tenant_isolation(
    db_session: AsyncSession, seed_company: Company
) -> None:
    await _mk_client(db_session, seed_company.id, source="crm", budget_max=_Decimal("3000000"))
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}", plan="pro", is_active=True
    )
    db_session.add(other)
    await db_session.commit()
    s = await clients_segmentation(db_session, other.id)
    assert s["total"] == 0
    assert s["golden_visa_budget_count"] == 0


# ── Import CSV en masse ──────────────────────────────────────────────────────

from app.routers.clients.service import parse_client_rows  # noqa: E402

_CSV_OK = (
    "type,first_name,last_name,email,phone\n"
    "individual,Lina,Haddad,lina@x.io,+971500000001\n"
    "company,,,info@acme.ae,+971500000002\n"
)


def test_parse_client_rows_valid_and_invalid() -> None:
    csv_text = (
        "type,first_name,email\n"
        "individual,Ali,ali@x.io\n"  # ok
        "banana,Bob,bob@x.io\n"  # type invalide
        "individual,Sam,not-an-email\n"  # email invalide
        "\n"  # ligne vide → ignorée
    )
    valid, errors = parse_client_rows(csv_text)
    assert [c.first_name for c in valid] == ["Ali"]
    lines = {e["line"] for e in errors}
    assert lines == {3, 4}  # lignes 3 (type) et 4 (email)


def test_parse_client_rows_ignores_unknown_columns() -> None:
    valid, errors = parse_client_rows("type,first_name,zzz\nindividual,Zoe,ignored\n")
    assert errors == []
    assert valid[0].first_name == "Zoe"


def test_parse_client_rows_row_limit() -> None:
    from app.routers.clients.service import CSV_IMPORT_MAX_ROWS

    rows = "\n".join(f"individual,Name{i},n{i}@x.io" for i in range(CSV_IMPORT_MAX_ROWS + 5))
    valid, errors = parse_client_rows("type,first_name,email\n" + rows + "\n")
    assert len(valid) == CSV_IMPORT_MAX_ROWS
    assert any("row_limit_exceeded" in e["error"] for e in errors)


async def test_import_csv_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/clients/import.csv",
        files={"file": ("c.csv", _CSV_OK.encode(), "text/csv")},
    )
    assert resp.status_code in (401, 403)


async def test_import_csv_creates_clients(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        "/api/v1/clients/import.csv",
        headers=headers,
        files={"file": ("c.csv", _CSV_OK.encode(), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["created"] == 2 and data["failed"] == 0
    # Les clients importés sont visibles côté liste du tenant.
    listed = await client.get("/api/v1/clients/?limit=100", headers=headers)
    emails = {c["email"] for c in listed.json()["data"]}
    assert {"lina@x.io", "info@acme.ae"} <= emails


async def test_import_csv_reports_invalid_rows(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    bad = "type,first_name,email\nindividual,Ok,ok@x.io\nbanana,Bad,bad@x.io\n"
    resp = await client.post(
        "/api/v1/clients/import.csv",
        headers=headers,
        files={"file": ("c.csv", bad.encode(), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["created"] == 1 and data["failed"] == 1
    assert data["errors"][0]["line"] == 3


async def test_import_csv_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : les clients importés par A sont invisibles pour le tenant B."""
    _, token_a = seed_admin
    _company_b, token_b = second_admin
    uniq = "iso-" + uuid.uuid4().hex[:8] + "@x.io"
    csv_text = f"type,first_name,email\nindividual,Isolated,{uniq}\n"
    r = await client.post(
        "/api/v1/clients/import.csv",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("c.csv", csv_text.encode(), "text/csv")},
    )
    assert r.json()["data"]["created"] == 1
    listed_b = await client.get(
        "/api/v1/clients/?limit=100", headers={"Authorization": f"Bearer {token_b}"}
    )
    emails_b = {c["email"] for c in listed_b.json()["data"]}
    assert uniq not in emails_b
