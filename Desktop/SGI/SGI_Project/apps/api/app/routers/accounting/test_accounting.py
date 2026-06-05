"""Tests Comptabilité — plan comptable, écritures (double entrée), balance, isolation.

Tests purs (validate_balanced / format_reference) sans DB + tests d'intégration
nécessitant PostgreSQL via `DATABASE_URL`.
Lancer : `docker compose exec api uv run pytest app/routers/accounting/test_accounting.py`.
"""

from __future__ import annotations

import re
import uuid
from decimal import Decimal

import pytest

from app.models.company import Company
from app.routers.accounting.schemas import (
    AccountCreate,
    JournalEntryCreate,
    JournalLineIn,
)
from app.routers.accounting.service import (
    AccountingError,
    create_account,
    create_journal_entry,
    format_reference,
    get_account,
    get_journal_entry,
    list_accounts,
    list_journal_entries,
    post_journal_entry,
    trial_balance,
    validate_balanced,
    void_journal_entry,
)

pytestmark = pytest.mark.asyncio


# ── Helpers ───────────────────────────────────────────────────────────────


def _line(account_id: uuid.UUID, *, debit: str = "0", credit: str = "0") -> JournalLineIn:
    return JournalLineIn(account_id=account_id, debit=Decimal(debit), credit=Decimal(credit))


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


async def _two_accounts(db, company_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    a = await create_account(
        db,
        company_id,
        AccountCreate(code=f"A{uuid.uuid4().hex[:6]}", name_en="Cash", type="asset"),
    )
    b = await create_account(
        db,
        company_id,
        AccountCreate(code=f"R{uuid.uuid4().hex[:6]}", name_en="Sales", type="revenue"),
    )
    return a.id, b.id


# ── Tests PURS (sans DB) ───────────────────────────────────────────────────


def test_format_reference() -> None:
    assert format_reference(2026, 1) == "JE-2026-00001"
    assert format_reference(2026, 42) == "JE-2026-00042"
    assert re.match(r"^JE-\d{4}-\d{5}$", format_reference(2026, 99999))


def test_validate_balanced_ok() -> None:
    aid = uuid.uuid4()
    bid = uuid.uuid4()
    validate_balanced([_line(aid, debit="100"), _line(bid, credit="100")])  # ne lève pas


def test_validate_balanced_rejects_imbalance() -> None:
    aid, bid = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(AccountingError) as exc:
        validate_balanced([_line(aid, debit="100"), _line(bid, credit="90")])
    assert exc.value.code == "entry_not_balanced"


def test_validate_balanced_rejects_single_line() -> None:
    with pytest.raises(AccountingError) as exc:
        validate_balanced([_line(uuid.uuid4(), debit="100")])
    assert exc.value.code == "entry_needs_two_lines"


def test_validate_balanced_rejects_debit_and_credit_on_same_line() -> None:
    aid, bid = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(AccountingError) as exc:
        validate_balanced([_line(aid, debit="100", credit="100"), _line(bid, credit="100")])
    assert exc.value.code == "line_must_be_debit_xor_credit"


def test_validate_balanced_rejects_zero_total() -> None:
    aid, bid = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(AccountingError) as exc:
        validate_balanced([_line(aid, debit="0"), _line(bid, credit="0")])
    # lignes nulles → XOR échoue avant le test du total
    assert exc.value.code == "line_must_be_debit_xor_credit"


# ── Tests INTÉGRATION — plan comptable ─────────────────────────────────────


async def test_create_account(db_session, seed_company: Company) -> None:
    acc = await create_account(
        db_session,
        seed_company.id,
        AccountCreate(code="1000", name_en="Cash", name_ar="نقد", type="asset"),
    )
    assert acc.id is not None
    assert acc.code == "1000"
    assert acc.is_active is True


async def test_create_account_duplicate_code_rejected(db_session, seed_company: Company) -> None:
    await create_account(
        db_session, seed_company.id, AccountCreate(code="2000", name_en="Bank", type="asset")
    )
    with pytest.raises(AccountingError) as exc:
        await create_account(
            db_session, seed_company.id, AccountCreate(code="2000", name_en="Other", type="asset")
        )
    assert exc.value.code == "account_code_exists"


async def test_create_account_cross_tenant_parent_rejected(
    db_session, seed_company: Company
) -> None:
    other = await _other_company(db_session)
    foreign = await create_account(
        db_session, other.id, AccountCreate(code="3000", name_en="Foreign", type="asset")
    )
    with pytest.raises(AccountingError) as exc:
        await create_account(
            db_session,
            seed_company.id,
            AccountCreate(code="3001", name_en="Child", type="asset", parent_id=foreign.id),
        )
    assert exc.value.code == "parent_not_found"


async def test_list_accounts_filter_by_type(db_session, seed_company: Company) -> None:
    await create_account(
        db_session, seed_company.id, AccountCreate(code="A1", name_en="Cash", type="asset")
    )
    await create_account(
        db_session, seed_company.id, AccountCreate(code="R1", name_en="Sales", type="revenue")
    )
    assets, n_assets = await list_accounts(db_session, seed_company.id, type_="asset")
    assert n_assets == 1 and assets[0].type == "asset"


async def test_get_account_cross_tenant_returns_none(db_session, seed_company: Company) -> None:
    other = await _other_company(db_session)
    acc = await create_account(
        db_session, seed_company.id, AccountCreate(code="9000", name_en="Cash", type="asset")
    )
    assert await get_account(db_session, other.id, acc.id) is None


# ── Tests INTÉGRATION — écritures de journal ───────────────────────────────


async def test_create_balanced_entry(db_session, seed_company: Company) -> None:
    from datetime import date

    a_id, b_id = await _two_accounts(db_session, seed_company.id)
    entry = await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            description="Vente",
            lines=[_line(a_id, debit="500"), _line(b_id, credit="500")],
        ),
    )
    assert re.match(r"^JE-2026-\d{5}$", entry.reference)
    assert entry.status == "draft"
    assert len(entry.lines) == 2


async def test_create_unbalanced_entry_rejected(db_session, seed_company: Company) -> None:
    from datetime import date

    a_id, b_id = await _two_accounts(db_session, seed_company.id)
    with pytest.raises(AccountingError) as exc:
        await create_journal_entry(
            db_session,
            seed_company.id,
            JournalEntryCreate(
                entry_date=date(2026, 6, 5),
                lines=[_line(a_id, debit="500"), _line(b_id, credit="400")],
            ),
        )
    assert exc.value.code == "entry_not_balanced"


async def test_create_entry_foreign_account_rejected(db_session, seed_company: Company) -> None:
    from datetime import date

    other = await _other_company(db_session)
    foreign_a, foreign_b = await _two_accounts(db_session, other.id)
    with pytest.raises(AccountingError) as exc:
        await create_journal_entry(
            db_session,
            seed_company.id,
            JournalEntryCreate(
                entry_date=date(2026, 6, 5),
                lines=[_line(foreign_a, debit="500"), _line(foreign_b, credit="500")],
            ),
        )
    assert exc.value.code == "account_not_found"


async def test_reference_sequence_increments(db_session, seed_company: Company) -> None:
    from datetime import date

    a_id, b_id = await _two_accounts(db_session, seed_company.id)

    def _payload() -> JournalEntryCreate:
        return JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="10"), _line(b_id, credit="10")],
        )

    e1 = await create_journal_entry(db_session, seed_company.id, _payload())
    e2 = await create_journal_entry(db_session, seed_company.id, _payload())
    assert e1.reference != e2.reference
    assert e1.reference.endswith("00001")
    assert e2.reference.endswith("00002")


async def test_post_entry_transitions_to_posted(db_session, seed_company: Company) -> None:
    from datetime import date

    a_id, b_id = await _two_accounts(db_session, seed_company.id)
    entry = await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="500"), _line(b_id, credit="500")],
        ),
    )
    posted = await post_journal_entry(db_session, seed_company.id, entry.id)
    assert posted is not None
    assert posted.status == "posted"
    assert posted.posted_at is not None


async def test_post_entry_twice_rejected(db_session, seed_company: Company) -> None:
    from datetime import date

    a_id, b_id = await _two_accounts(db_session, seed_company.id)
    entry = await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="1"), _line(b_id, credit="1")],
        ),
    )
    await post_journal_entry(db_session, seed_company.id, entry.id)
    with pytest.raises(AccountingError) as exc:
        await post_journal_entry(db_session, seed_company.id, entry.id)
    assert exc.value.code == "entry_not_draft"


async def test_void_entry(db_session, seed_company: Company) -> None:
    from datetime import date

    a_id, b_id = await _two_accounts(db_session, seed_company.id)
    entry = await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="1"), _line(b_id, credit="1")],
        ),
    )
    voided = await void_journal_entry(db_session, seed_company.id, entry.id)
    assert voided is not None and voided.status == "void"


# ── Tests INTÉGRATION — balance générale ───────────────────────────────────


async def test_trial_balance_sums_posted_only(db_session, seed_company: Company) -> None:
    from datetime import date

    a_id, b_id = await _two_accounts(db_session, seed_company.id)

    posted = await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="700"), _line(b_id, credit="700")],
        ),
    )
    await post_journal_entry(db_session, seed_company.id, posted.id)

    # Brouillon non posté → exclu de la balance.
    await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="999"), _line(b_id, credit="999")],
        ),
    )

    tb = await trial_balance(db_session, seed_company.id)
    assert tb.total_debit == Decimal("700.00")
    assert tb.total_credit == Decimal("700.00")
    assert tb.total_debit == tb.total_credit


# ── Isolation Loi 1 ─────────────────────────────────────────────────────────


async def test_get_entry_cross_tenant_returns_none(db_session, seed_company: Company) -> None:
    from datetime import date

    other = await _other_company(db_session)
    a_id, b_id = await _two_accounts(db_session, seed_company.id)
    entry = await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="50"), _line(b_id, credit="50")],
        ),
    )
    assert await get_journal_entry(db_session, other.id, entry.id) is None


async def test_list_entries_isolated_per_tenant(db_session, seed_company: Company) -> None:
    from datetime import date

    other = await _other_company(db_session)
    a_id, b_id = await _two_accounts(db_session, seed_company.id)
    await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="5"), _line(b_id, credit="5")],
        ),
    )
    _, mine = await list_journal_entries(db_session, seed_company.id)
    _, theirs = await list_journal_entries(db_session, other.id)
    assert mine == 1
    assert theirs == 0


async def test_trial_balance_isolated_per_tenant(db_session, seed_company: Company) -> None:
    from datetime import date

    other = await _other_company(db_session)
    a_id, b_id = await _two_accounts(db_session, seed_company.id)
    e = await create_journal_entry(
        db_session,
        seed_company.id,
        JournalEntryCreate(
            entry_date=date(2026, 6, 5),
            lines=[_line(a_id, debit="80"), _line(b_id, credit="80")],
        ),
    )
    await post_journal_entry(db_session, seed_company.id, e.id)

    tb_other = await trial_balance(db_session, other.id)
    assert tb_other.total_debit == Decimal("0")
    assert tb_other.rows == []
