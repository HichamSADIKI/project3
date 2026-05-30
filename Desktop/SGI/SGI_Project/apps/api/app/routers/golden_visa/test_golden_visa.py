"""Tests Golden Visa — CRUD, isolation tenant, alertes d'expiration.

Le service lit le `company_id` via le GUC `app.current_company_id` (posé en prod
par TenantMiddleware sur une connexion épinglée). Dans le harness de test
(NullPool), chaque `commit()` libère la connexion ; on (re)pose donc le GUC en
`is_local` SANS commit, juste avant chaque appel de service, dans la même
transaction que sa lecture.

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/golden_visa/test_golden_visa.py`.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import text

from app.models.client import Client
from app.models.company import Company
from app.routers.golden_visa.schemas import GoldenVisaCreate, GoldenVisaUpdate
from app.routers.golden_visa.service import (
    VALID_STATUSES,
    create_application,
    delete_application,
    get_application,
    get_expiring_visas,
    list_applications,
    update_application,
)


async def _set_tenant(db, company_id: uuid.UUID) -> None:
    """Pose le GUC tenant SANS commit (is_local) → lu par le service dans la
    même transaction. Doit être appelé juste avant chaque appel de service."""
    await db.execute(
        text("SELECT set_config('app.current_company_id', :cid, true)"),
        {"cid": str(company_id)},
    )


async def _seed_client(db, company: Company) -> uuid.UUID:
    client = Client(
        id=uuid.uuid4(),
        company_id=company.id,
        type="individual",
        first_name="Investisseur",
        last_name="Test",
    )
    db.add(client)
    await db.commit()
    return client.id


async def _other_company(db) -> Company:
    c = Company(
        id=uuid.uuid4(),
        name="Autre",
        slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db.add(c)
    await db.commit()
    return c


# ── Constante de statuts (pur) ───────────────────────────────────────────────


def test_valid_statuses_contain_lifecycle() -> None:
    assert {"pending", "approved", "rejected", "expired"} <= VALID_STATUSES


# ── create / get ─────────────────────────────────────────────────────────────


async def test_create_and_get(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)

    await _set_tenant(db_session, seed_company.id)
    app = await create_application(
        db_session, GoldenVisaCreate(client_id=client_id, status="pending")
    )
    assert app.company_id == seed_company.id
    assert app.client_id == client_id

    await _set_tenant(db_session, seed_company.id)
    fetched = await get_application(db_session, app.id)
    assert fetched is not None and fetched.id == app.id


async def test_get_cross_tenant_returns_none(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)
    other = await _other_company(db_session)

    await _set_tenant(db_session, seed_company.id)
    app = await create_application(db_session, GoldenVisaCreate(client_id=client_id))

    # Bascule de contexte tenant → l'application n'est plus visible.
    await _set_tenant(db_session, other.id)
    assert await get_application(db_session, app.id) is None


# ── list (filtres + meta) ────────────────────────────────────────────────────


async def test_list_filters_by_status(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)

    await _set_tenant(db_session, seed_company.id)
    await create_application(db_session, GoldenVisaCreate(client_id=client_id, status="pending"))
    await _set_tenant(db_session, seed_company.id)
    await create_application(db_session, GoldenVisaCreate(client_id=client_id, status="approved"))

    await _set_tenant(db_session, seed_company.id)
    res_all = await list_applications(db_session)
    assert res_all["meta"]["total"] == 2
    assert res_all["meta"]["page"] == 1

    await _set_tenant(db_session, seed_company.id)
    res_approved = await list_applications(db_session, status="approved")
    assert res_approved["meta"]["total"] == 1
    assert res_approved["data"][0].status == "approved"


async def test_list_filters_by_client(db_session, seed_company: Company) -> None:
    c1 = await _seed_client(db_session, seed_company)
    c2 = await _seed_client(db_session, seed_company)

    await _set_tenant(db_session, seed_company.id)
    await create_application(db_session, GoldenVisaCreate(client_id=c1))
    await _set_tenant(db_session, seed_company.id)
    await create_application(db_session, GoldenVisaCreate(client_id=c2))

    await _set_tenant(db_session, seed_company.id)
    res = await list_applications(db_session, client_id=c1)
    assert res["meta"]["total"] == 1
    assert res["data"][0].client_id == c1


# ── update / delete ──────────────────────────────────────────────────────────


async def test_update_status(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)
    await _set_tenant(db_session, seed_company.id)
    app = await create_application(db_session, GoldenVisaCreate(client_id=client_id))

    await _set_tenant(db_session, seed_company.id)
    updated = await update_application(db_session, app.id, GoldenVisaUpdate(status="submitted"))
    assert updated is not None and updated.status == "submitted"


async def test_update_unknown_returns_none(db_session, seed_company: Company) -> None:
    await _set_tenant(db_session, seed_company.id)
    assert (
        await update_application(db_session, uuid.uuid4(), GoldenVisaUpdate(status="approved"))
        is None
    )


async def test_delete_is_soft(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)
    await _set_tenant(db_session, seed_company.id)
    app = await create_application(db_session, GoldenVisaCreate(client_id=client_id))

    await _set_tenant(db_session, seed_company.id)
    assert await delete_application(db_session, app.id) is True

    await _set_tenant(db_session, seed_company.id)
    assert await get_application(db_session, app.id) is None  # exclu (deleted_at)


async def test_delete_unknown_returns_false(db_session, seed_company: Company) -> None:
    await _set_tenant(db_session, seed_company.id)
    assert await delete_application(db_session, uuid.uuid4()) is False


# ── alertes d'expiration ─────────────────────────────────────────────────────


async def test_get_expiring_visas(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)
    soon = date.today() + timedelta(days=30)
    far = date.today() + timedelta(days=300)

    await _set_tenant(db_session, seed_company.id)
    near = await create_application(
        db_session,
        GoldenVisaCreate(client_id=client_id, status="approved", visa_expiry_date=soon),
    )
    # Approuvé mais lointain → hors fenêtre 90 j
    await _set_tenant(db_session, seed_company.id)
    await create_application(
        db_session,
        GoldenVisaCreate(client_id=client_id, status="approved", visa_expiry_date=far),
    )
    # Fenêtre proche mais pas approuvé → exclu
    await _set_tenant(db_session, seed_company.id)
    await create_application(
        db_session,
        GoldenVisaCreate(client_id=client_id, status="submitted", visa_expiry_date=soon),
    )

    await _set_tenant(db_session, seed_company.id)
    expiring = await get_expiring_visas(db_session, days=90)
    ids = {a.id for a in expiring}
    assert near.id in ids
    assert all(a.status == "approved" for a in expiring)
