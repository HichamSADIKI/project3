"""Tests Reporting — agrégations par tenant (service) + gardes du router.

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/reporting/test_reporting.py`.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.building import Building
from app.models.client import Client
from app.models.company import Company
from app.models.contract import Contract
from app.models.finance import FinanceTransaction
from app.models.golden_visa import GoldenVisaApplication
from app.models.maintenance import MaintenanceTicket
from app.models.property import Property
from app.models.rental import Rental
from app.models.user import User, UserRole, UserStatus
from app.routers.reporting.service import (
    financial_report,
    maintenance_report,
    overview,
    rental_report,
)

pytestmark = pytest.mark.asyncio


# ── Helpers de seeding ───────────────────────────────────────────────────────


async def _make_finance(
    db, company: Company, direction: str, status: str, amount: str, type_: str = "payment"
) -> None:
    db.add(
        FinanceTransaction(
            id=uuid.uuid4(), company_id=company.id,
            reference=f"TXN-{uuid.uuid4().hex[:10]}", type=type_,
            direction=direction, amount=Decimal(amount), status=status,
        )
    )
    await db.commit()


async def _make_property(db, company: Company) -> None:
    db.add(
        Property(
            id=uuid.uuid4(), company_id=company.id,
            reference=f"PROP-{uuid.uuid4().hex[:10]}", type="apartment",
            price=Decimal("1000000"),
        )
    )
    await db.commit()


async def _make_client(db, company: Company) -> Client:
    c = Client(
        id=uuid.uuid4(), company_id=company.id, type="individual",
        first_name="A", last_name="B",
    )
    db.add(c)
    await db.commit()
    return c


async def _make_gv(db, company: Company, client_id: uuid.UUID, status: str) -> None:
    db.add(
        GoldenVisaApplication(
            id=uuid.uuid4(), company_id=company.id, client_id=client_id, status=status
        )
    )
    await db.commit()


async def _make_rental(
    db, company: Company, status: str, monthly: str, end_date: date
) -> None:
    client = await _make_client(db, company)
    prop = Property(
        id=uuid.uuid4(), company_id=company.id,
        reference=f"P-{uuid.uuid4().hex[:10]}", type="apartment", price=Decimal("900000"),
    )
    db.add(prop)
    await db.commit()
    contract = Contract(
        id=uuid.uuid4(), company_id=company.id,
        reference=f"CTR-{uuid.uuid4().hex[:10]}", type="rental",
        client_id=client.id, property_id=prop.id, amount=Decimal("60000"),
    )
    db.add(contract)
    await db.commit()
    db.add(
        Rental(
            id=uuid.uuid4(), company_id=company.id, contract_id=contract.id,
            client_id=client.id, property_id=prop.id,
            monthly_rent=Decimal(monthly), annual_rent=Decimal(monthly) * 12,
            status=status, start_date=date(2026, 1, 1), end_date=end_date,
        )
    )
    await db.commit()


async def _make_ticket(
    db, company: Company, user_id: uuid.UUID, status: str, priority: str = "medium"
) -> None:
    # ck_maintenance_tickets_location : unit_id OU building_id requis.
    building = Building(
        id=uuid.uuid4(), company_id=company.id,
        reference=f"BLD-{uuid.uuid4().hex[:10]}", building_type="residential_tower",
    )
    db.add(building)
    await db.commit()
    db.add(
        MaintenanceTicket(
            id=uuid.uuid4(), company_id=company.id,
            reference=f"MNT-{uuid.uuid4().hex[:8]}",
            reported_by_user_id=user_id, building_id=building.id, category="plumbing",
            status=status, priority=priority, title="Fuite",
        )
    )
    await db.commit()


# ── overview ─────────────────────────────────────────────────────────────────


async def test_overview_counts_and_net(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = Company(id=admin.company_id, name="x", slug="x")  # placeholder, not added
    company.id = admin.company_id

    await _make_property(db_session, company)
    await _make_property(db_session, company)
    client = await _make_client(db_session, company)
    await _make_gv(db_session, company, client.id, "pending")
    await _make_gv(db_session, company, client.id, "approved")  # terminal → exclu
    await _make_rental(db_session, company, "active", "5000", date(2026, 12, 1))
    await _make_ticket(db_session, company, admin.id, "new")
    await _make_ticket(db_session, company, admin.id, "closed")  # clos → exclu
    await _make_finance(db_session, company, "credit", "paid", "10000")
    await _make_finance(db_session, company, "debit", "paid", "3000")

    rep = await overview(db_session, company.id)
    # 2 biens directs + 1 bien créé par le bail (via _make_rental).
    assert rep.properties_total == 3
    assert rep.clients_total >= 2  # client direct + clients créés par les baux
    assert rep.active_rentals == 1
    assert rep.open_maintenance == 1
    assert rep.golden_visa_pending == 1
    assert rep.net_revenue == Decimal("7000.00")


# ── financial ────────────────────────────────────────────────────────────────


async def test_financial_report(
    db_session: AsyncSession, seed_company: Company
) -> None:
    await _make_finance(db_session, seed_company, "credit", "paid", "10000", "payment")
    await _make_finance(db_session, seed_company, "debit", "paid", "2500", "expense")
    await _make_finance(db_session, seed_company, "credit", "pending", "4000", "invoice")

    rep = await financial_report(db_session, seed_company.id)
    assert rep.total_revenue == Decimal("10000.00")
    assert rep.total_expenses == Decimal("2500.00")
    assert rep.net == Decimal("7500.00")
    assert rep.pending_amount == Decimal("4000.00")
    assert rep.paid_by_type["payment"] == Decimal("10000.00")
    assert rep.paid_by_type["expense"] == Decimal("2500.00")
    assert "invoice" not in rep.paid_by_type  # pending → exclu du paid_by_type


# ── rentals ──────────────────────────────────────────────────────────────────


async def test_rental_report(
    db_session: AsyncSession, seed_company: Company
) -> None:
    soon = date.today() + timedelta(days=30)
    far = date.today() + timedelta(days=400)
    await _make_rental(db_session, seed_company, "active", "5000", soon)
    await _make_rental(db_session, seed_company, "active", "3000", far)
    await _make_rental(db_session, seed_company, "terminated", "2000", far)

    rep = await rental_report(db_session, seed_company.id, expiring_days=120)
    assert rep.active_count == 2
    assert rep.by_status["active"] == 2
    assert rep.by_status["terminated"] == 1
    assert rep.monthly_rent_roll == Decimal("8000.00")  # 5000 + 3000 (actifs)
    assert rep.expiring_soon == 1  # seul le bail actif à J+30


# ── maintenance ──────────────────────────────────────────────────────────────


async def test_maintenance_report(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = Company(id=admin.company_id, name="x", slug="x")
    company.id = admin.company_id

    await _make_ticket(db_session, company, admin.id, "new", "high")
    await _make_ticket(db_session, company, admin.id, "in_progress", "urgent")
    await _make_ticket(db_session, company, admin.id, "closed", "low")

    rep = await maintenance_report(db_session, company.id)
    assert rep.by_status["new"] == 1
    assert rep.by_status["in_progress"] == 1
    assert rep.by_status["closed"] == 1
    assert rep.by_priority["high"] == 1
    assert rep.open_count == 2  # new + in_progress (closed exclu)


# ── isolation tenant ─────────────────────────────────────────────────────────


async def test_overview_isolated_per_tenant(
    db_session: AsyncSession, seed_company: Company
) -> None:
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro", is_active=True,
    )
    db_session.add(other)
    await db_session.commit()
    await _make_property(db_session, other)  # bien d'une AUTRE société

    rep = await overview(db_session, seed_company.id)
    assert rep.properties_total == 0  # n'inclut pas le bien de l'autre tenant


# ── Router : gardes ──────────────────────────────────────────────────────────


async def test_overview_endpoint_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/reporting/overview")
    assert resp.status_code == 403  # garde staff (rôle absent)


async def test_overview_endpoint_forbidden_for_client_role(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user = User(
        id=uuid.uuid4(), company_id=seed_company.id,
        email=f"cli-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("Passw0rd!23"), full_name="Cli",
        role=UserRole.CLIENT.value, status=UserStatus.ACTIVE.value, is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    token = encode_jwt({
        "sub": str(user.id), "company_id": str(user.company_id),
        "role": user.role, "status": user.status, "email": user.email,
    })
    resp = await client.get(
        "/api/v1/reporting/overview", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403


async def test_overview_endpoint_ok_for_admin(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    resp = await client.get(
        "/api/v1/reporting/overview", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "net_revenue" in body
    assert "properties_total" in body
