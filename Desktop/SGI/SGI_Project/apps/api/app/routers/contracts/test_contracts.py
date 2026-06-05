"""Tests Contracts — helpers purs (renouvellement M5) + CRUD/renew multi-tenant.

⚠️ Tests d'intégration (parties DB) : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/contracts/test_contracts.py`.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.company import Company
from app.models.property import Property
from app.routers.contracts.schemas import (
    ContractCreate,
    ContractRenew,
    ContractUpdate,
)
from app.routers.contracts.service import (
    apply_rent_escalation,
    compute_renewal_dates,
    contract_expiry_state,
    create_contract,
    delete_contract,
    expiring_contracts,
    get_contract,
    is_renewable,
    list_contracts,
    renew_contract,
    update_contract,
)

# ── contract_expiry_state (pur) ──────────────────────────────────────────────


class TestContractExpiryState:
    today = date(2026, 6, 1)

    def test_non_active_is_none(self) -> None:
        for st in ("draft", "signed", "expired", "cancelled"):
            assert contract_expiry_state(self.today, date(2026, 6, 10), st) is None

    def test_no_end_date_is_none(self) -> None:
        assert contract_expiry_state(self.today, None, "active") is None

    def test_expired(self) -> None:
        assert contract_expiry_state(self.today, date(2026, 5, 20), "active") == "expired"

    def test_expiring_soon(self) -> None:
        assert contract_expiry_state(self.today, date(2026, 6, 15), "active") == "expiring_soon"
        # borne : exactement 30 jours → encore expiring_soon
        assert contract_expiry_state(self.today, date(2026, 7, 1), "active") == "expiring_soon"

    def test_active(self) -> None:
        assert contract_expiry_state(self.today, date(2026, 9, 1), "active") == "active"


# ── Helpers purs (déjà couverts — conservés) ─────────────────────────────────


class TestIsRenewable:
    @pytest.mark.parametrize("status", ["active", "expired"])
    def test_renewable_states(self, status: str) -> None:
        assert is_renewable(status) is True

    @pytest.mark.parametrize("status", ["draft", "signed", "cancelled", "bogus"])
    def test_non_renewable_states(self, status: str) -> None:
        assert is_renewable(status) is False


class TestComputeRenewalDates:
    def test_new_start_is_day_after_old_end(self) -> None:
        start, _end = compute_renewal_dates(date(2025, 1, 1), date(2025, 12, 31))
        assert start == date(2026, 1, 1)

    def test_reconducts_duration_when_no_term(self) -> None:
        start, end = compute_renewal_dates(date(2025, 1, 1), date(2025, 12, 31))
        assert start == date(2026, 1, 1)
        assert end is not None and end > start

    def test_explicit_term_months(self) -> None:
        start, end = compute_renewal_dates(date(2025, 1, 1), date(2025, 6, 30), 24)
        assert start == date(2025, 7, 1)
        assert end == date(2027, 7, 1)

    def test_none_end_returns_none(self) -> None:
        assert compute_renewal_dates(None, None) == (None, None)

    def test_no_old_start_defaults_12_months(self) -> None:
        start, end = compute_renewal_dates(None, date(2025, 6, 30))
        assert start == date(2025, 7, 1)
        assert end == date(2026, 7, 1)


class TestApplyRentEscalation:
    def test_zero_pct_unchanged(self) -> None:
        assert apply_rent_escalation(Decimal("100000"), Decimal("0")) == Decimal("100000.00")

    def test_five_pct(self) -> None:
        assert apply_rent_escalation(Decimal("100000"), Decimal("5")) == Decimal("105000.00")

    def test_rounds_half_up_two_decimals(self) -> None:
        # 99999 * 1.075 = 107498.925 → 107498.93
        assert apply_rent_escalation(Decimal("99999"), Decimal("7.5")) == Decimal("107498.93")

    def test_result_quantized(self) -> None:
        result = apply_rent_escalation(Decimal("12345"), Decimal("3.3"))
        assert result.as_tuple().exponent == -2


# ── Fixtures DB ──────────────────────────────────────────────────────────────


async def _seed_client_property(
    db: AsyncSession, company_id: uuid.UUID
) -> tuple[uuid.UUID, uuid.UUID]:
    client = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name="Partie",
        last_name="Test",
    )
    prop = Property(
        id=uuid.uuid4(),
        company_id=company_id,
        reference=f"PROP-{uuid.uuid4().hex[:10]}",
        type="apartment",
        price=Decimal("1500000"),
        status="available",
    )
    db.add_all([client, prop])
    await db.commit()
    return client.id, prop.id


async def _make_contract(db, company_id, **overrides):
    client_id, prop_id = await _seed_client_property(db, company_id)
    data = ContractCreate(
        type=overrides.pop("type", "sale"),
        client_id=client_id,
        property_id=prop_id,
        amount=overrides.pop("amount", Decimal("1000000")),
        commission_rate=overrides.pop("commission_rate", Decimal("2.0")),
        start_date=overrides.pop("start_date", date(2026, 1, 1)),
        end_date=overrides.pop("end_date", date(2026, 12, 31)),
        **overrides,
    )
    return await create_contract(db, company_id, data)


# ── CRUD ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_reference_and_commission(
    db_session: AsyncSession, seed_company: Company
) -> None:
    c = await _make_contract(
        db_session, seed_company.id, amount=Decimal("1000000"), commission_rate=Decimal("2.5")
    )
    assert c.reference.startswith("CNT-")
    assert c.status == "draft"
    assert c.commission_amount == Decimal("25000.00")  # 1M × 2.5 %


@pytest.mark.asyncio
async def test_get_cross_tenant_none(db_session: AsyncSession, seed_company: Company) -> None:
    c = await _make_contract(db_session, seed_company.id)
    other = Company(
        id=uuid.uuid4(),
        name="Autre",
        slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db_session.add(other)
    await db_session.commit()
    assert await get_contract(db_session, other.id, c.id) is None


@pytest.mark.asyncio
async def test_list_filter_by_type(db_session: AsyncSession, seed_company: Company) -> None:
    await _make_contract(db_session, seed_company.id, type="sale")
    await _make_contract(db_session, seed_company.id, type="rental")
    rentals, n = await list_contracts(db_session, seed_company.id, type_="rental")
    assert n == 1 and rentals[0].type == "rental"


@pytest.mark.asyncio
async def test_update_signed_sets_signed_at(
    db_session: AsyncSession, seed_company: Company
) -> None:
    c = await _make_contract(db_session, seed_company.id)
    updated = await update_contract(
        db_session, seed_company.id, c.id, ContractUpdate(status="signed")
    )
    assert updated is not None and updated.signed_at is not None


@pytest.mark.asyncio
async def test_update_active_sale_marks_property_sold(
    db_session: AsyncSession, seed_company: Company
) -> None:
    c = await _make_contract(db_session, seed_company.id, type="sale")
    await update_contract(db_session, seed_company.id, c.id, ContractUpdate(status="active"))
    prop = (
        await db_session.execute(select(Property).where(Property.id == c.property_id))
    ).scalar_one()
    assert prop.status == "sold"


@pytest.mark.asyncio
async def test_update_recomputes_commission(
    db_session: AsyncSession, seed_company: Company
) -> None:
    c = await _make_contract(db_session, seed_company.id, amount=Decimal("1000000"))
    updated = await update_contract(
        db_session, seed_company.id, c.id, ContractUpdate(amount=Decimal("2000000"))
    )
    assert updated is not None
    assert updated.commission_amount == Decimal("40000.00")  # 2M × 2 %


# ── Suppression (draft uniquement) ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_draft_ok(db_session: AsyncSession, seed_company: Company) -> None:
    c = await _make_contract(db_session, seed_company.id)
    assert await delete_contract(db_session, seed_company.id, c.id) is True
    assert await get_contract(db_session, seed_company.id, c.id) is None


@pytest.mark.asyncio
async def test_delete_non_draft_raises(db_session: AsyncSession, seed_company: Company) -> None:
    c = await _make_contract(db_session, seed_company.id)
    await update_contract(db_session, seed_company.id, c.id, ContractUpdate(status="active"))
    with pytest.raises(ValueError):
        await delete_contract(db_session, seed_company.id, c.id)


# ── Renouvellement (M5) ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_renew_creates_linked_escalated_contract(
    db_session: AsyncSession, seed_company: Company
) -> None:
    c = await _make_contract(db_session, seed_company.id, amount=Decimal("100000"))
    await update_contract(db_session, seed_company.id, c.id, ContractUpdate(status="active"))

    new = await renew_contract(
        db_session,
        seed_company.id,
        c.id,
        ContractRenew(term_months=12, rent_escalation_pct=Decimal("5")),
    )
    assert isinstance(new, type(c))
    assert new.status == "draft"
    assert new.renewed_from_contract_id == c.id
    assert new.amount == Decimal("105000.00")  # +5 %


@pytest.mark.asyncio
async def test_renew_draft_is_not_renewable(
    db_session: AsyncSession, seed_company: Company
) -> None:
    c = await _make_contract(db_session, seed_company.id)  # reste draft
    result = await renew_contract(db_session, seed_company.id, c.id, ContractRenew())
    assert result == "not_renewable"


@pytest.mark.asyncio
async def test_renew_unknown_returns_none(db_session: AsyncSession, seed_company: Company) -> None:
    result = await renew_contract(db_session, seed_company.id, uuid.uuid4(), ContractRenew())
    assert result is None


# ── expiring_contracts (intégration service, multi-tenant) ───────────────────


async def _active_contract(db, company_id, *, end: date):
    """Crée un contrat puis le passe 'active' avec une date de fin donnée."""
    c = await _make_contract(db, company_id, start_date=date(2026, 1, 1), end_date=end)
    c.status = "active"
    c.end_date = end
    await db.commit()
    return c


@pytest.mark.asyncio
async def test_expiring_contracts_states_and_order(
    db_session: AsyncSession, seed_company: Company
) -> None:
    today = date(2026, 6, 1)
    soon = await _active_contract(
        db_session, seed_company.id, end=date(2026, 6, 20)
    )  # expiring_soon
    overdue = await _active_contract(db_session, seed_company.id, end=date(2026, 5, 25))  # expired
    far = await _active_contract(db_session, seed_company.id, end=date(2027, 1, 1))  # hors 90j

    rows = await expiring_contracts(db_session, seed_company.id, today, days=90)
    by_id = {r["id"]: r for r in rows}
    assert soon.id in by_id and by_id[soon.id]["expiry_state"] == "expiring_soon"
    assert overdue.id in by_id and by_id[overdue.id]["expiry_state"] == "expired"
    assert far.id not in by_id  # au-delà de l'horizon
    # tri par date de fin → l'expiré (passé) avant le proche
    ids = [r["id"] for r in rows]
    assert ids.index(overdue.id) < ids.index(soon.id)
    # surface l'éligibilité + dates de renouvellement suggérées
    assert by_id[soon.id]["is_renewable"] is True
    assert by_id[soon.id]["suggested_renewal_start"] == date(2026, 6, 21)


@pytest.mark.asyncio
async def test_expiring_contracts_excludes_draft(
    db_session: AsyncSession, seed_company: Company
) -> None:
    # contrat draft avec fin proche → exclu (statut ≠ active)
    await _make_contract(db_session, seed_company.id, end_date=date(2026, 6, 10))
    rows = await expiring_contracts(db_session, seed_company.id, date(2026, 6, 1), days=90)
    assert rows == []


@pytest.mark.asyncio
async def test_expiring_contracts_tenant_isolation(
    db_session: AsyncSession, seed_company: Company
) -> None:
    """Les contrats de A ne remontent pas pour une autre société (Loi 1)."""
    await _active_contract(db_session, seed_company.id, end=date(2026, 6, 20))
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}", plan="pro", is_active=True
    )
    db_session.add(other)
    await db_session.commit()
    rows = await expiring_contracts(db_session, other.id, date(2026, 6, 1), days=90)
    assert rows == []
