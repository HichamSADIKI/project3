"""Tests Finance — CRUD transactions, génération de référence, KPIs, isolation.

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/finance/test_finance.py`.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.models.company import Company
from app.routers.finance.schemas import TransactionCreate, TransactionUpdate
from app.routers.finance.service import (
    create_transaction,
    get_summary,
    get_transaction,
    list_transactions,
    update_transaction,
)

pytestmark = pytest.mark.asyncio


def _txn(**overrides) -> TransactionCreate:
    base = dict(type="invoice", direction="credit", amount=Decimal("1000"))
    base.update(overrides)
    return TransactionCreate(**base)


async def _other_company(db) -> Company:
    c = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro", is_active=True,
    )
    db.add(c)
    await db.commit()
    return c


# ── create : référence auto + statut par défaut ──────────────────────────────


async def test_create_generates_reference_and_pending(
    db_session, seed_company: Company
) -> None:
    txn = await create_transaction(db_session, seed_company.id, _txn())
    assert re.match(r"^TXN-\d{4}-\d{5}$", txn.reference)
    assert txn.status == "pending"
    assert txn.amount == Decimal("1000.00")


# ── get + isolation tenant ───────────────────────────────────────────────────


async def test_get_cross_tenant_returns_none(
    db_session, seed_company: Company
) -> None:
    other = await _other_company(db_session)
    txn = await create_transaction(db_session, seed_company.id, _txn())
    assert await get_transaction(db_session, other.id, txn.id) is None


# ── list : filtres + isolation ───────────────────────────────────────────────


async def test_list_filters_by_direction_and_type(
    db_session, seed_company: Company
) -> None:
    await create_transaction(db_session, seed_company.id, _txn(type="invoice", direction="credit"))
    await create_transaction(db_session, seed_company.id, _txn(type="expense", direction="debit"))

    credits, n_credit = await list_transactions(db_session, seed_company.id, direction="credit")
    assert n_credit == 1 and credits[0].direction == "credit"

    expenses, n_exp = await list_transactions(db_session, seed_company.id, type_="expense")
    assert n_exp == 1 and expenses[0].type == "expense"


async def test_list_isolated_per_tenant(
    db_session, seed_company: Company
) -> None:
    other = await _other_company(db_session)
    await create_transaction(db_session, seed_company.id, _txn())
    await create_transaction(db_session, other.id, _txn())

    _, mine = await list_transactions(db_session, seed_company.id)
    assert mine == 1


# ── update : passage à "paid" pose paid_at ───────────────────────────────────


async def test_update_status_paid_sets_paid_at(
    db_session, seed_company: Company
) -> None:
    txn = await create_transaction(db_session, seed_company.id, _txn())
    assert txn.paid_at is None
    updated = await update_transaction(
        db_session, seed_company.id, txn.id, TransactionUpdate(status="paid")
    )
    assert updated is not None
    assert updated.status == "paid"
    assert updated.paid_at is not None


async def test_update_unknown_returns_none(
    db_session, seed_company: Company
) -> None:
    assert (
        await update_transaction(
            db_session, seed_company.id, uuid.uuid4(), TransactionUpdate(status="paid")
        )
        is None
    )


# ── summary : KPIs financiers ────────────────────────────────────────────────


async def test_summary_aggregates_revenue_expenses_net(
    db_session, seed_company: Company
) -> None:
    # Revenu encaissé : credit + paid
    rev = await create_transaction(
        db_session, seed_company.id, _txn(type="payment", direction="credit", amount=Decimal("10000"))
    )
    await update_transaction(db_session, seed_company.id, rev.id, TransactionUpdate(status="paid"))
    # Dépense payée : debit + paid
    exp = await create_transaction(
        db_session, seed_company.id, _txn(type="expense", direction="debit", amount=Decimal("3000"))
    )
    await update_transaction(db_session, seed_company.id, exp.id, TransactionUpdate(status="paid"))
    # Facture en attente : invoice + pending
    await create_transaction(
        db_session, seed_company.id, _txn(type="invoice", direction="credit", amount=Decimal("2500"))
    )

    summary = await get_summary(db_session, seed_company.id)
    assert summary.total_revenue == Decimal("10000.00")
    assert summary.total_expenses == Decimal("3000.00")
    assert summary.net == Decimal("7000.00")
    assert summary.pending_invoices == 1
    assert summary.pending_amount == Decimal("2500.00")
    assert summary.paid_this_month >= Decimal("13000.00")


async def test_summary_empty_is_zero(
    db_session, seed_company: Company
) -> None:
    summary = await get_summary(db_session, seed_company.id)
    assert summary.total_revenue == Decimal("0")
    assert summary.net == Decimal("0")
    assert summary.pending_invoices == 0
