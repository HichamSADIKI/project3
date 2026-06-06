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
            id=uuid.uuid4(),
            company_id=company.id,
            reference=f"TXN-{uuid.uuid4().hex[:10]}",
            type=type_,
            direction=direction,
            amount=Decimal(amount),
            status=status,
        )
    )
    await db.commit()


async def _make_property(db, company: Company) -> None:
    db.add(
        Property(
            id=uuid.uuid4(),
            company_id=company.id,
            reference=f"PROP-{uuid.uuid4().hex[:10]}",
            type="apartment",
            price=Decimal("1000000"),
        )
    )
    await db.commit()


async def _make_client(db, company: Company) -> Client:
    c = Client(
        id=uuid.uuid4(),
        company_id=company.id,
        type="individual",
        first_name="A",
        last_name="B",
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


async def _make_rental(db, company: Company, status: str, monthly: str, end_date: date) -> None:
    client = await _make_client(db, company)
    prop = Property(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"P-{uuid.uuid4().hex[:10]}",
        type="apartment",
        price=Decimal("900000"),
    )
    db.add(prop)
    await db.commit()
    contract = Contract(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"CTR-{uuid.uuid4().hex[:10]}",
        type="rental",
        client_id=client.id,
        property_id=prop.id,
        amount=Decimal("60000"),
    )
    db.add(contract)
    await db.commit()
    db.add(
        Rental(
            id=uuid.uuid4(),
            company_id=company.id,
            contract_id=contract.id,
            client_id=client.id,
            property_id=prop.id,
            monthly_rent=Decimal(monthly),
            annual_rent=Decimal(monthly) * 12,
            status=status,
            start_date=date(2026, 1, 1),
            end_date=end_date,
        )
    )
    await db.commit()


async def _make_ticket(
    db, company: Company, user_id: uuid.UUID, status: str, priority: str = "medium"
) -> None:
    # ck_maintenance_tickets_location : unit_id OU building_id requis.
    building = Building(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"BLD-{uuid.uuid4().hex[:10]}",
        building_type="residential_tower",
    )
    db.add(building)
    await db.commit()
    db.add(
        MaintenanceTicket(
            id=uuid.uuid4(),
            company_id=company.id,
            reference=f"MNT-{uuid.uuid4().hex[:8]}",
            reported_by_user_id=user_id,
            building_id=building.id,
            category="plumbing",
            status=status,
            priority=priority,
            title="Fuite",
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


async def test_financial_report(db_session: AsyncSession, seed_company: Company) -> None:
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


async def test_rental_report(db_session: AsyncSession, seed_company: Company) -> None:
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


async def test_maintenance_report(db_session: AsyncSession, seed_admin: tuple[User, str]) -> None:
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
        id=uuid.uuid4(),
        name="Autre",
        slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
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
        id=uuid.uuid4(),
        company_id=seed_company.id,
        email=f"cli-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("Passw0rd!23"),
        full_name="Cli",
        role=UserRole.CLIENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )
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


# ── Tableau de bord exécutif (BI) ──────────────────────────────────────────


def test_compute_headline_pure() -> None:
    """Helper pur : dérive les chiffres-clés sans DB."""
    from app.routers.finance.schemas import AgedBuckets, AgedReceivables, FinanceSummary
    from app.routers.reporting.service import compute_headline

    finance = FinanceSummary(
        total_revenue=Decimal("1000"),
        total_expenses=Decimal("400"),
        net=Decimal("600"),
        pending_invoices=2,
        pending_amount=Decimal("250"),
        paid_this_month=Decimal("1000"),
    )
    receivables = AgedReceivables(
        buckets=AgedBuckets(
            current=Decimal("0"),
            d1_30=Decimal("100"),
            d31_60=Decimal("0"),
            d61_90=Decimal("0"),
            d90plus=Decimal("50"),
        ),
        total=Decimal("150"),
        count=3,
    )
    crm = {"new": 4, "contacted": 2, "qualified": 1, "won": 5, "lost": 9}
    sales = {
        "offers": {"open_amount_aed": Decimal("2000")},
        "transactions": {"completed_value_aed": Decimal("9000")},
    }
    h = compute_headline(
        finance=finance,
        receivables=receivables,
        rentals={"monthly_rent_aed": Decimal("3500")},
        units={"occupancy_rate_pct": 82},
        crm=crm,
        sales=sales,
    )
    assert h.net_paid == Decimal("600")
    assert h.pending_amount == Decimal("250")
    assert h.overdue_total == Decimal("150")
    assert h.overdue_count == 3
    assert h.monthly_rent_roll == Decimal("3500")
    assert h.occupancy_rate_pct == 82
    assert h.active_leads == 7  # 4+2+1, hors won/lost
    assert h.sales_completed_value == Decimal("9000")
    assert h.open_offers_amount == Decimal("2000")


def test_compute_headline_tolerates_missing_keys() -> None:
    """Robustesse : agrégats partiels (clés absentes) → zéros, pas d'exception."""
    from app.routers.finance.schemas import AgedBuckets, AgedReceivables, FinanceSummary
    from app.routers.reporting.service import compute_headline

    finance = FinanceSummary(
        total_revenue=Decimal("0"),
        total_expenses=Decimal("0"),
        net=Decimal("0"),
        pending_invoices=0,
        pending_amount=Decimal("0"),
        paid_this_month=Decimal("0"),
    )
    receivables = AgedReceivables(
        buckets=AgedBuckets(
            current=Decimal("0"),
            d1_30=Decimal("0"),
            d31_60=Decimal("0"),
            d61_90=Decimal("0"),
            d90plus=Decimal("0"),
        ),
        total=Decimal("0"),
        count=0,
    )
    h = compute_headline(
        finance=finance,
        receivables=receivables,
        rentals={},
        units={},
        crm={},
        sales={},
    )
    assert h.monthly_rent_roll == Decimal("0")
    assert h.occupancy_rate_pct == 0
    assert h.active_leads == 0
    assert h.open_offers_amount == Decimal("0")


async def test_executive_endpoint_ok_for_admin(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    resp = await client.get(
        "/api/v1/reporting/executive", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "headline",
        "overview",
        "finance",
        "cashflow",
        "receivables",
        "sales",
        "leasing",
        "rentals",
        "crm",
        "units",
    ):
        assert key in body, f"clé manquante : {key}"
    assert "net_paid" in body["headline"]


async def test_executive_endpoint_forbidden_for_client_role(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user = User(
        id=uuid.uuid4(),
        company_id=seed_company.id,
        email=f"cli-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("Passw0rd!23"),
        full_name="Cli",
        role=UserRole.CLIENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )
    resp = await client.get(
        "/api/v1/reporting/executive", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403


# ── Commissions agents (rapprochement) ─────────────────────────────────────


def test_roll_up_commissions_pure() -> None:
    """Helper pur : regroupe par agent, totaux globaux, tri par total."""
    import uuid as _uuid

    from app.routers.reporting.service import roll_up_commissions

    a1, a2 = _uuid.uuid4(), _uuid.uuid4()
    rows = [
        (a1, "Karim", "pending", Decimal("100")),
        (a1, "Karim", "paid", Decimal("300")),
        (a1, "Karim", "cancelled", Decimal("50")),
        (a2, "Reem", "payable", Decimal("80")),
    ]
    agents, totals = roll_up_commissions(rows)
    assert [a.agent_name for a in agents] == ["Karim", "Reem"]  # tri par total desc
    karim = agents[0]
    assert karim.pending == Decimal("100")
    assert karim.paid == Decimal("300")
    assert karim.cancelled == Decimal("50")
    assert karim.total == Decimal("400")  # hors cancelled
    assert totals["paid"] == Decimal("300")
    assert totals["cancelled"] == Decimal("50")
    assert totals["total"] == Decimal("480")


def test_roll_up_commissions_empty() -> None:
    from app.routers.reporting.service import roll_up_commissions

    agents, totals = roll_up_commissions([])
    assert agents == []
    assert totals["total"] == Decimal("0")


async def test_commissions_endpoint_ok_for_admin(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    resp = await client.get(
        "/api/v1/reporting/commissions", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "agents" in body and "totals" in body and "count" in body


async def test_commissions_endpoint_forbidden_for_client_role(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user = User(
        id=uuid.uuid4(),
        company_id=seed_company.id,
        email=f"cli-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("Passw0rd!23"),
        full_name="Cli",
        role=UserRole.CLIENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )
    resp = await client.get(
        "/api/v1/reporting/commissions", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403
