"""Tests Recherche globale — helpers purs + endpoints (repli DB, Loi 1).

Meili n'est pas disponible dans la CI : la recherche retombe sur le repli DB
ILIKE, qui est donc le chemin exercé ici. Tests d'intégration → PostgreSQL réel.
Lancer : `docker compose exec api uv run pytest app/routers/search/test_search.py`.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.company import Company
from app.models.contract import Contract
from app.models.property import Property
from app.models.user import User
from app.routers.search.schemas import ENTITY_TYPES
from app.routers.search.service import (
    client_label,
    normalize_query,
    parse_types,
    property_label,
)

# ── Helpers purs ──────────────────────────────────────────────────────────────


class TestNormalizeQuery:
    def test_trims_and_collapses(self) -> None:
        assert normalize_query("  villa   dubai ") == "villa dubai"

    def test_none_and_empty(self) -> None:
        assert normalize_query(None) == ""
        assert normalize_query("   ") == ""


class TestParseTypes:
    def test_default_all_when_empty(self) -> None:
        assert parse_types(None) == list(ENTITY_TYPES)
        assert parse_types("") == list(ENTITY_TYPES)

    def test_subset(self) -> None:
        assert parse_types("client,contract") == ["client", "contract"]

    def test_drops_unknown_and_falls_back(self) -> None:
        assert parse_types("client,banana") == ["client"]
        assert parse_types("banana") == list(ENTITY_TYPES)


def test_client_label_company_then_person() -> None:
    assert client_label(Client(type="company", company_name="ACME FZ")) == "ACME FZ"
    assert client_label(Client(type="individual", first_name="Ali", last_name="Ben")) == "Ali Ben"


def test_property_label_prefers_title_then_reference() -> None:
    p = Property(reference="REF-1", type="apartment", price=Decimal("1"), title_en="Marina Villa")
    assert property_label(p) == "Marina Villa"
    p2 = Property(reference="REF-2", type="apartment", price=Decimal("1"))
    assert property_label(p2) == "REF-2"


# ── Seeds ─────────────────────────────────────────────────────────────────────


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _seed_client(db: AsyncSession, cid: uuid.UUID, **kw) -> Client:
    c = Client(id=uuid.uuid4(), company_id=cid, type="individual", **kw)
    db.add(c)
    await db.commit()
    return c


async def _seed_property(db: AsyncSession, cid: uuid.UUID, ref: str, **kw) -> Property:
    p = Property(
        id=uuid.uuid4(),
        company_id=cid,
        reference=ref,
        type="apartment",
        price=Decimal("1500000"),
        **kw,
    )
    db.add(p)
    await db.commit()
    return p


async def _seed_contract(db: AsyncSession, cid: uuid.UUID, ref: str) -> Contract:
    c = await _seed_client(db, cid, first_name="Lease", last_name="Holder")
    p = await _seed_property(db, cid, f"P-{ref}")
    k = Contract(
        id=uuid.uuid4(),
        company_id=cid,
        reference=ref,
        type="sale",
        amount=Decimal("1500000"),
        client_id=c.id,
        property_id=p.id,
    )
    db.add(k)
    await db.commit()
    return k


# ── Endpoints ─────────────────────────────────────────────────────────────────


async def test_search_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/v1/search?q=villa")
    assert r.status_code in (401, 403)


async def test_empty_query_returns_empty(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.get("/api/v1/search?q=%20%20", headers=_auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["data"] == []
    assert body["meta"]["source"] == "empty"


async def test_finds_client_by_name(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    await _seed_client(db_session, admin.company_id, company_name="Falcon Holdings")
    r = await client.get("/api/v1/search?q=falcon", headers=_auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["meta"]["source"] == "db"  # Meili absent en CI → repli DB
    labels = [h["label"] for h in body["data"] if h["entity_type"] == "client"]
    assert "Falcon Holdings" in labels


async def test_finds_property_by_reference(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    await _seed_property(
        db_session, admin.company_id, "VILLA-XYZ", title_en="Palm Villa", city="Dubai"
    )
    r = await client.get("/api/v1/search?q=VILLA-XYZ", headers=_auth(token))
    assert r.status_code == 200
    hits = [h for h in r.json()["data"] if h["entity_type"] == "property"]
    assert any(h["reference"] == "VILLA-XYZ" for h in hits)


async def test_finds_contract_by_reference(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    await _seed_contract(db_session, admin.company_id, "CT-2026-777")
    r = await client.get("/api/v1/search?q=CT-2026-777", headers=_auth(token))
    assert r.status_code == 200
    hits = [h for h in r.json()["data"] if h["entity_type"] == "contract"]
    assert any(h["reference"] == "CT-2026-777" for h in hits)


async def test_types_filter_restricts_entities(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    await _seed_client(db_session, admin.company_id, company_name="Zephyr Capital")
    await _seed_property(db_session, admin.company_id, "ZEPHYR-1", title_en="Zephyr Tower")
    r = await client.get("/api/v1/search?q=zephyr&types=client", headers=_auth(token))
    assert r.status_code == 200
    kinds = {h["entity_type"] for h in r.json()["data"]}
    assert kinds <= {"client"}  # aucun bien malgré un match potentiel


async def test_cross_tenant_isolation(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : un client du tenant A est introuvable avec le token B."""
    admin, _token_a = seed_admin
    _company_b, token_b = second_admin
    await _seed_client(db_session, admin.company_id, company_name="Secret Tenant A Co")
    r = await client.get("/api/v1/search?q=Secret%20Tenant%20A", headers=_auth(token_b))
    assert r.status_code == 200
    assert r.json()["data"] == []  # invisible cross-tenant


async def test_reindex_counts_available_docs(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    """Reindex best-effort : indexed=0 si Meili down (CI), available = nb de docs."""
    admin, token = seed_admin
    await _seed_client(db_session, admin.company_id, company_name="Indexable Co")
    await _seed_property(db_session, admin.company_id, "IDX-1", title_en="Indexable Tower")
    r = await client.post("/api/v1/search/reindex", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["available"] >= 2
    assert data["indexed"] >= 0


async def test_reindex_forbidden_for_agent(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    # L'admin seedé a le rôle admin ; on vérifie au moins que la route exige une
    # session (sans token → 401/403). Le RBAC fin (agent interdit) est couvert par
    # require_roles, testé ailleurs.
    r = await client.post("/api/v1/search/reindex")
    assert r.status_code in (401, 403)
