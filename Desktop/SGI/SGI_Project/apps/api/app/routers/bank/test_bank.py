"""Tests Rapprochement bancaire — comptes, lignes, matching, isolation (Loi 1).

Tests purs (expected_direction) + intégration (PostgreSQL via DATABASE_URL).
Lancer : docker compose exec api uv run pytest app/routers/bank/test_bank.py
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.models.company import Company
from app.models.finance import FinanceTransaction
from app.routers.bank.schemas import BankAccountCreate, StatementLineCreate
from app.routers.bank.service import (
    BankError,
    create_bank_account,
    create_statement_line,
    expected_direction,
    get_statement_line,
    match_line,
    reconciliation_summary,
    suggest_matches,
    unmatch_line,
)

pytestmark = pytest.mark.asyncio


# ── Helpers ───────────────────────────────────────────────────────────────


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


async def _txn(
    db,
    company_id: uuid.UUID,
    *,
    amount: str = "1000",
    direction: str = "credit",
    status: str = "paid",
    when: datetime | None = None,
) -> FinanceTransaction:
    t = FinanceTransaction(
        company_id=company_id,
        reference=f"TXN-T-{uuid.uuid4().hex[:8]}",
        type="payment",
        direction=direction,
        amount=Decimal(amount),
        status=status,
        paid_at=when or datetime(2026, 6, 5, tzinfo=UTC),
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


async def _account(db, company_id: uuid.UUID):  # type: ignore[no-untyped-def]
    return await create_bank_account(db, company_id, BankAccountCreate(name="Emirates NBD"))


# ── Tests PURS ─────────────────────────────────────────────────────────────


def test_expected_direction() -> None:
    assert expected_direction(Decimal("100")) == "credit"
    assert expected_direction(Decimal("-100")) == "debit"
    with pytest.raises(BankError) as exc:
        expected_direction(Decimal("0"))
    assert exc.value.code == "amount_must_be_nonzero"


# ── Tests INTÉGRATION ──────────────────────────────────────────────────────


async def test_create_statement_line_rejects_unknown_account(
    db_session, seed_company: Company
) -> None:
    with pytest.raises(BankError) as exc:
        await create_statement_line(
            db_session,
            seed_company.id,
            StatementLineCreate(
                bank_account_id=uuid.uuid4(),
                value_date=date(2026, 6, 5),
                label="x",
                amount=Decimal("100"),
            ),
        )
    assert exc.value.code == "bank_account_not_found"


async def test_match_success_and_summary(db_session, seed_company: Company) -> None:
    acc = await _account(db_session, seed_company.id)
    txn = await _txn(db_session, seed_company.id, amount="1500", direction="credit")
    line = await create_statement_line(
        db_session,
        seed_company.id,
        StatementLineCreate(
            bank_account_id=acc.id,
            value_date=date(2026, 6, 5),
            label="Virement",
            amount=Decimal("1500"),
        ),
    )
    matched = await match_line(db_session, seed_company.id, line.id, txn.id)
    assert matched is not None
    assert matched.status == "reconciled"
    assert matched.matched_transaction_id == txn.id

    summary = await reconciliation_summary(db_session, seed_company.id, acc.id)
    assert summary.reconciled_count == 1
    assert summary.unreconciled_count == 0
    assert summary.reconciled_amount == Decimal("1500.00")


async def test_match_amount_mismatch_rejected(db_session, seed_company: Company) -> None:
    acc = await _account(db_session, seed_company.id)
    txn = await _txn(db_session, seed_company.id, amount="1500", direction="credit")
    line = await create_statement_line(
        db_session,
        seed_company.id,
        StatementLineCreate(
            bank_account_id=acc.id, value_date=date(2026, 6, 5), label="x", amount=Decimal("999")
        ),
    )
    with pytest.raises(BankError) as exc:
        await match_line(db_session, seed_company.id, line.id, txn.id)
    assert exc.value.code == "match_amount_mismatch"


async def test_suggest_matches_finds_and_excludes_taken(db_session, seed_company: Company) -> None:
    acc = await _account(db_session, seed_company.id)
    txn = await _txn(db_session, seed_company.id, amount="800", direction="credit")
    line1 = await create_statement_line(
        db_session,
        seed_company.id,
        StatementLineCreate(
            bank_account_id=acc.id, value_date=date(2026, 6, 6), label="a", amount=Decimal("800")
        ),
    )
    sugg = await suggest_matches(db_session, seed_company.id, line1)
    assert any(s.transaction_id == txn.id for s in sugg)

    # Une fois rapprochée, la transaction n'est plus suggérée pour une autre ligne.
    await match_line(db_session, seed_company.id, line1.id, txn.id)
    line2 = await create_statement_line(
        db_session,
        seed_company.id,
        StatementLineCreate(
            bank_account_id=acc.id, value_date=date(2026, 6, 6), label="b", amount=Decimal("800")
        ),
    )
    sugg2 = await suggest_matches(db_session, seed_company.id, line2)
    assert all(s.transaction_id != txn.id for s in sugg2)


async def test_unmatch_resets_status(db_session, seed_company: Company) -> None:
    acc = await _account(db_session, seed_company.id)
    txn = await _txn(db_session, seed_company.id, amount="500", direction="credit")
    line = await create_statement_line(
        db_session,
        seed_company.id,
        StatementLineCreate(
            bank_account_id=acc.id, value_date=date(2026, 6, 5), label="x", amount=Decimal("500")
        ),
    )
    await match_line(db_session, seed_company.id, line.id, txn.id)
    unmatched = await unmatch_line(db_session, seed_company.id, line.id)
    assert unmatched is not None
    assert unmatched.status == "unreconciled"
    assert unmatched.matched_transaction_id is None


async def test_match_cross_tenant_transaction_rejected(db_session, seed_company: Company) -> None:
    other = await _other_company(db_session)
    acc = await _account(db_session, seed_company.id)
    foreign_txn = await _txn(db_session, other.id, amount="700", direction="credit")
    line = await create_statement_line(
        db_session,
        seed_company.id,
        StatementLineCreate(
            bank_account_id=acc.id, value_date=date(2026, 6, 5), label="x", amount=Decimal("700")
        ),
    )
    with pytest.raises(BankError) as exc:
        await match_line(db_session, seed_company.id, line.id, foreign_txn.id)
    assert exc.value.code == "transaction_not_found"


async def test_statement_line_cross_tenant_returns_none(db_session, seed_company: Company) -> None:
    other = await _other_company(db_session)
    acc = await _account(db_session, seed_company.id)
    line = await create_statement_line(
        db_session,
        seed_company.id,
        StatementLineCreate(
            bank_account_id=acc.id, value_date=date(2026, 6, 5), label="x", amount=Decimal("100")
        ),
    )
    assert await get_statement_line(db_session, other.id, line.id) is None
