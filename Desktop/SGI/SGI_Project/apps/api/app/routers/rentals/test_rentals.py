"""Tests Rentals — helpers purs (calendrier de paiement) + CRUD multi-tenant.

⚠️ Tests d'intégration (partie service) : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/rentals/test_rentals.py`.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.models.client import Client
from app.models.company import Company
from app.models.contract import Contract
from app.models.property import Property
from app.routers.rentals.schemas import RentalCreate, RentalUpdate
from app.routers.rentals.service import (
    _add_months,
    _build_payment_schedule,
    create_rental,
    get_expiring_rentals,
    get_rental,
    list_rentals,
    update_rental,
)


# ── Helpers purs : _add_months ───────────────────────────────────────────────


class TestAddMonths:
    def test_same_year(self) -> None:
        assert _add_months(date(2026, 1, 15), 2) == date(2026, 3, 15)

    def test_year_rollover(self) -> None:
        assert _add_months(date(2026, 12, 10), 2) == date(2027, 2, 10)

    def test_day_clamp_end_of_month(self) -> None:
        # 31 janvier + 1 mois → 28 février (2026 non bissextile)
        assert _add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)

    def test_twelve_months_is_one_year(self) -> None:
        assert _add_months(date(2026, 5, 1), 12) == date(2027, 5, 1)


# ── Helpers purs : _build_payment_schedule ──────────────────────────────────


class TestBuildPaymentSchedule:
    def test_monthly_count_over_a_year(self) -> None:
        sched = _build_payment_schedule(
            date(2026, 1, 1), date(2026, 12, 1), Decimal("5000"), "monthly"
        )
        assert len(sched) == 12
        assert sched[0]["amount"] == "5000"
        assert sched[0]["status"] == "pending"
        assert sched[0]["paid_at"] is None

    def test_quarterly_interval_and_amount(self) -> None:
        sched = _build_payment_schedule(
            date(2026, 1, 1), date(2026, 12, 31), Decimal("5000"), "quarterly"
        )
        assert len(sched) == 4  # jan, avr, juil, oct
        assert sched[0]["amount"] == "15000"  # 5000 × 3 mois

    def test_annual_single_period(self) -> None:
        sched = _build_payment_schedule(
            date(2026, 1, 1), date(2026, 12, 31), Decimal("5000"), "annual"
        )
        assert len(sched) == 1
        assert sched[0]["amount"] == "60000"  # 5000 × 12

    def test_unknown_frequency_defaults_monthly(self) -> None:
        sched = _build_payment_schedule(
            date(2026, 1, 1), date(2026, 3, 1), Decimal("100"), "bogus"
        )
        assert len(sched) == 3  # repli mensuel


# ── Fixtures DB : chaîne contract/client/property ────────────────────────────


async def _seed_chain(db, company: Company) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """Crée client + bien + contrat (FK requises par Rental). Renvoie leurs IDs."""
    client = Client(
        id=uuid.uuid4(), company_id=company.id, type="individual",
        first_name="Locataire", last_name="Test",
    )
    prop = Property(
        id=uuid.uuid4(), company_id=company.id,
        reference=f"PROP-{uuid.uuid4().hex[:10]}", type="apartment",
        price=Decimal("1200000"),
    )
    db.add_all([client, prop])
    await db.commit()
    contract = Contract(
        id=uuid.uuid4(), company_id=company.id,
        reference=f"CTR-{uuid.uuid4().hex[:10]}", type="rental",
        client_id=client.id, property_id=prop.id, amount=Decimal("60000"),
    )
    db.add(contract)
    await db.commit()
    return contract.id, client.id, prop.id


def _rental_create(contract_id, client_id, property_id, **overrides) -> RentalCreate:
    base = dict(
        contract_id=contract_id, client_id=client_id, property_id=property_id,
        monthly_rent=Decimal("5000"), deposit=Decimal("10000"),
        payment_frequency="monthly",
        start_date=date(2026, 1, 1), end_date=date(2026, 12, 1),
    )
    base.update(overrides)
    return RentalCreate(**base)


# ── Service : create / get / isolation ───────────────────────────────────────


@pytest.mark.asyncio
async def test_create_computes_annual_rent_and_schedule(
    db_session, seed_company: Company
) -> None:
    cid_, client_id, prop_id = await _seed_chain(db_session, seed_company)
    rental = await create_rental(
        db_session, seed_company.id, _rental_create(cid_, client_id, prop_id)
    )
    assert rental.annual_rent == Decimal("60000.00")  # 5000 × 12
    assert rental.status == "active"
    assert rental.renewal_alert_sent is False
    assert len(rental.payment_schedule) == 12


@pytest.mark.asyncio
async def test_get_cross_tenant_returns_none(
    db_session, seed_company: Company
) -> None:
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro", is_active=True,
    )
    db_session.add(other)
    await db_session.commit()
    cid_, client_id, prop_id = await _seed_chain(db_session, seed_company)
    rental = await create_rental(
        db_session, seed_company.id, _rental_create(cid_, client_id, prop_id)
    )
    assert await get_rental(db_session, other.id, rental.id) is None


# ── Service : list (filtres) ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_status_filter(db_session, seed_company: Company) -> None:
    cid_, client_id, prop_id = await _seed_chain(db_session, seed_company)
    r = await create_rental(
        db_session, seed_company.id, _rental_create(cid_, client_id, prop_id)
    )
    await update_rental(
        db_session, seed_company.id, r.id, RentalUpdate(status="terminated")
    )
    _, n_active = await list_rentals(db_session, seed_company.id, status="active")
    _, n_term = await list_rentals(db_session, seed_company.id, status="terminated")
    assert n_active == 0
    assert n_term == 1


# ── Service : update (recalcul annual_rent) ──────────────────────────────────


@pytest.mark.asyncio
async def test_update_monthly_rent_recomputes_annual(
    db_session, seed_company: Company
) -> None:
    cid_, client_id, prop_id = await _seed_chain(db_session, seed_company)
    r = await create_rental(
        db_session, seed_company.id, _rental_create(cid_, client_id, prop_id)
    )
    updated = await update_rental(
        db_session, seed_company.id, r.id, RentalUpdate(monthly_rent=Decimal("6000"))
    )
    assert updated is not None
    assert updated.annual_rent == Decimal("72000.00")  # 6000 × 12


@pytest.mark.asyncio
async def test_update_unknown_returns_none(
    db_session, seed_company: Company
) -> None:
    assert (
        await update_rental(
            db_session, seed_company.id, uuid.uuid4(), RentalUpdate(status="expired")
        )
        is None
    )


# ── Service : expiring (alertes J-120) ───────────────────────────────────────


@pytest.mark.asyncio
async def test_get_expiring_rentals(db_session, seed_company: Company) -> None:
    from datetime import timedelta
    # contract_id est unique (1 bail / contrat) → une chaîne distincte par bail.
    chain_soon = await _seed_chain(db_session, seed_company)
    chain_far = await _seed_chain(db_session, seed_company)
    soon = date.today() + timedelta(days=30)
    far = date.today() + timedelta(days=400)

    r_soon = await create_rental(
        db_session, seed_company.id,
        _rental_create(*chain_soon, end_date=soon),
    )
    await create_rental(
        db_session, seed_company.id,
        _rental_create(*chain_far, end_date=far),
    )

    expiring = await get_expiring_rentals(db_session, seed_company.id, days=120)
    ids = {r.id for r in expiring}
    assert r_soon.id in ids
    assert all(r.end_date <= date.today() + timedelta(days=120) for r in expiring)


# ── Service : soft-delete exclu de la liste ──────────────────────────────────


@pytest.mark.asyncio
async def test_soft_deleted_excluded_from_list(
    db_session, seed_company: Company
) -> None:
    cid_, client_id, prop_id = await _seed_chain(db_session, seed_company)
    r = await create_rental(
        db_session, seed_company.id, _rental_create(cid_, client_id, prop_id)
    )
    r.deleted_at = datetime.now(timezone.utc)
    await db_session.commit()

    assert await get_rental(db_session, seed_company.id, r.id) is None
    _, total = await list_rentals(db_session, seed_company.id)
    assert total == 0
