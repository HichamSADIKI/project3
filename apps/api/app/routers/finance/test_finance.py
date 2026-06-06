"""Tests Finance — CRUD transactions, génération de référence, KPIs, isolation.

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/finance/test_finance.py`.
"""

from __future__ import annotations

import re
import uuid
from decimal import Decimal

import pytest

from app.models.company import Company
from app.routers.finance.schemas import TransactionCreate, TransactionUpdate
from app.routers.finance.service import (
    bucket_receivables,
    compute_vat,
    create_transaction,
    get_aged_receivables,
    get_pnl,
    get_summary,
    get_transaction,
    get_vat_report,
    list_transactions,
    period_start,
    update_transaction,
)

pytestmark = pytest.mark.asyncio


def _txn(**overrides) -> TransactionCreate:
    base = dict(type="invoice", direction="credit", amount=Decimal("1000"))
    base.update(overrides)
    return TransactionCreate(**base)


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


# ── create : référence auto + statut par défaut ──────────────────────────────


async def test_create_generates_reference_and_pending(db_session, seed_company: Company) -> None:
    txn = await create_transaction(db_session, seed_company.id, _txn())
    assert re.match(r"^TXN-\d{4}-\d{5}$", txn.reference)
    assert txn.status == "pending"
    assert txn.amount == Decimal("1000.00")


# ── get + isolation tenant ───────────────────────────────────────────────────


async def test_get_cross_tenant_returns_none(db_session, seed_company: Company) -> None:
    other = await _other_company(db_session)
    txn = await create_transaction(db_session, seed_company.id, _txn())
    assert await get_transaction(db_session, other.id, txn.id) is None


# ── list : filtres + isolation ───────────────────────────────────────────────


async def test_list_filters_by_direction_and_type(db_session, seed_company: Company) -> None:
    await create_transaction(db_session, seed_company.id, _txn(type="invoice", direction="credit"))
    await create_transaction(db_session, seed_company.id, _txn(type="expense", direction="debit"))

    credits, n_credit = await list_transactions(db_session, seed_company.id, direction="credit")
    assert n_credit == 1 and credits[0].direction == "credit"

    expenses, n_exp = await list_transactions(db_session, seed_company.id, type_="expense")
    assert n_exp == 1 and expenses[0].type == "expense"


async def test_list_isolated_per_tenant(db_session, seed_company: Company) -> None:
    other = await _other_company(db_session)
    await create_transaction(db_session, seed_company.id, _txn())
    await create_transaction(db_session, other.id, _txn())

    _, mine = await list_transactions(db_session, seed_company.id)
    assert mine == 1


# ── update : passage à "paid" pose paid_at ───────────────────────────────────


async def test_update_status_paid_sets_paid_at(db_session, seed_company: Company) -> None:
    txn = await create_transaction(db_session, seed_company.id, _txn())
    assert txn.paid_at is None
    updated = await update_transaction(
        db_session, seed_company.id, txn.id, TransactionUpdate(status="paid")
    )
    assert updated is not None
    assert updated.status == "paid"
    assert updated.paid_at is not None


async def test_update_unknown_returns_none(db_session, seed_company: Company) -> None:
    assert (
        await update_transaction(
            db_session, seed_company.id, uuid.uuid4(), TransactionUpdate(status="paid")
        )
        is None
    )


# ── summary : KPIs financiers ────────────────────────────────────────────────


async def test_summary_aggregates_revenue_expenses_net(db_session, seed_company: Company) -> None:
    # Revenu encaissé : credit + paid
    rev = await create_transaction(
        db_session,
        seed_company.id,
        _txn(type="payment", direction="credit", amount=Decimal("10000")),
    )
    await update_transaction(db_session, seed_company.id, rev.id, TransactionUpdate(status="paid"))
    # Dépense payée : debit + paid
    exp = await create_transaction(
        db_session, seed_company.id, _txn(type="expense", direction="debit", amount=Decimal("3000"))
    )
    await update_transaction(db_session, seed_company.id, exp.id, TransactionUpdate(status="paid"))
    # Facture en attente : invoice + pending
    await create_transaction(
        db_session,
        seed_company.id,
        _txn(type="invoice", direction="credit", amount=Decimal("2500")),
    )

    summary = await get_summary(db_session, seed_company.id)
    assert summary.total_revenue == Decimal("10000.00")
    assert summary.total_expenses == Decimal("3000.00")
    assert summary.net == Decimal("7000.00")
    assert summary.pending_invoices == 1
    assert summary.pending_amount == Decimal("2500.00")
    assert summary.paid_this_month >= Decimal("13000.00")


async def test_summary_empty_is_zero(db_session, seed_company: Company) -> None:
    summary = await get_summary(db_session, seed_company.id)
    assert summary.total_revenue == Decimal("0")
    assert summary.net == Decimal("0")
    assert summary.pending_invoices == 0


# ── Rapports : helpers purs ───────────────────────────────────────────────


def test_period_start_month_quarter_ytd() -> None:
    from datetime import UTC, datetime

    now = datetime(2026, 8, 17, 14, 30, tzinfo=UTC)
    assert period_start("month", now).date().isoformat() == "2026-08-01"
    assert period_start("quarter", now).date().isoformat() == "2026-07-01"  # Q3 = juil
    assert period_start("ytd", now).date().isoformat() == "2026-01-01"


def test_bucket_receivables_ages() -> None:
    from datetime import date

    today = date(2026, 6, 4)
    items = [
        (Decimal("100"), None),  # current (pas d'échéance)
        (Decimal("50"), date(2026, 7, 1)),  # current (future)
        (Decimal("30"), date(2026, 5, 20)),  # 15j → d1_30
        (Decimal("40"), date(2026, 4, 20)),  # 45j → d31_60
        (Decimal("60"), date(2026, 3, 20)),  # 76j → d61_90
        (Decimal("70"), date(2026, 1, 1)),  # >90j → d90plus
    ]
    b = bucket_receivables(items, today)
    assert b["current"] == Decimal("150")
    assert b["d1_30"] == Decimal("30")
    assert b["d31_60"] == Decimal("40")
    assert b["d61_90"] == Decimal("60")
    assert b["d90plus"] == Decimal("70")


# ── Rapports : agrégations DB ─────────────────────────────────────────────


async def test_pnl_groups_paid_by_type(db_session, seed_company: Company) -> None:
    cid = seed_company.id
    # 2 revenus payés (credit) + 1 dépense payée (debit) + 1 non payé (ignoré).
    for amt, typ, direction in [
        ("100", "commission", "credit"),
        ("40", "invoice", "credit"),
        ("25", "expense", "debit"),
    ]:
        txn = await create_transaction(
            db_session, cid, _txn(type=typ, direction=direction, amount=Decimal(amt))
        )
        await update_transaction(db_session, cid, txn.id, TransactionUpdate(status="paid"))
    # Non payé → exclu du P&L.
    await create_transaction(
        db_session, cid, _txn(type="commission", direction="credit", amount=Decimal("999"))
    )

    pnl = await get_pnl(db_session, cid, "ytd")
    assert pnl.total_revenue == Decimal("140")
    assert pnl.total_expenses == Decimal("25")
    assert pnl.net == Decimal("115")
    assert pnl.revenue_by_type.get("commission") == Decimal("100")
    assert pnl.revenue_by_type.get("invoice") == Decimal("40")


async def test_aged_receivables_counts_unpaid_invoices(db_session, seed_company: Company) -> None:
    cid = seed_company.id
    await create_transaction(
        db_session, cid, _txn(type="invoice", direction="credit", amount=Decimal("500"))
    )  # pending, pas d'échéance → current
    aged = await get_aged_receivables(db_session, cid)
    assert aged.count == 1
    assert aged.total == Decimal("500")
    assert aged.buckets.current == Decimal("500")


# ── Rapport TVA (UAE 5 %) ─────────────────────────────────────────────────


def test_compute_vat_5pct() -> None:
    v = compute_vat(Decimal("10000"), Decimal("4000"))
    assert v["output_vat"] == Decimal("500.00")
    assert v["input_vat"] == Decimal("200.00")
    assert v["net_vat"] == Decimal("300.00")


def test_compute_vat_credit_when_expenses_higher() -> None:
    v = compute_vat(Decimal("1000"), Decimal("3000"))
    assert v["net_vat"] == Decimal("-100.00")  # crédit de TVA


async def test_vat_report_on_paid_transactions(db_session, seed_company: Company) -> None:
    cid = seed_company.id
    rev = await create_transaction(
        db_session, cid, _txn(type="commission", direction="credit", amount=Decimal("20000"))
    )
    await update_transaction(db_session, cid, rev.id, TransactionUpdate(status="paid"))
    exp = await create_transaction(
        db_session, cid, _txn(type="expense", direction="debit", amount=Decimal("8000"))
    )
    await update_transaction(db_session, cid, exp.id, TransactionUpdate(status="paid"))
    # Non payé → exclu.
    await create_transaction(
        db_session, cid, _txn(type="invoice", direction="credit", amount=Decimal("99999"))
    )

    vat = await get_vat_report(db_session, cid, "ytd")
    assert vat.taxable_revenue == Decimal("20000")
    assert vat.output_vat == Decimal("1000.00")
    assert vat.input_vat == Decimal("400.00")
    assert vat.net_vat == Decimal("600.00")
    assert vat.rate == Decimal("0.05")


# ── Export CSV ────────────────────────────────────────────────────────────


async def test_transactions_csv_header_and_row(db_session, seed_company: Company) -> None:
    from app.routers.finance.service import transactions_csv

    await create_transaction(
        db_session,
        seed_company.id,
        _txn(
            type="commission",
            direction="credit",
            amount=Decimal("1500"),
            description_fr="Honoraires",
        ),
    )
    csv_text = await transactions_csv(db_session, seed_company.id)
    lines = csv_text.strip().splitlines()
    assert (
        lines[0]
        == "reference,date,type,direction,amount,currency,status,due_date,paid_at,description"
    )
    assert "commission,credit,1500.00,AED,pending" in lines[1]
    assert lines[1].endswith("Honoraires")


async def test_transactions_csv_isolated_and_filtered(db_session, seed_company: Company) -> None:
    from app.routers.finance.service import transactions_csv

    other = await _other_company(db_session)
    await create_transaction(db_session, seed_company.id, _txn(type="expense", direction="debit"))
    await create_transaction(db_session, seed_company.id, _txn(type="invoice", direction="credit"))
    await create_transaction(db_session, other.id, _txn())  # autre tenant → exclu

    # Filtre type=expense → 1 ligne data.
    csv_text = await transactions_csv(db_session, seed_company.id, type_="expense")
    assert len(csv_text.strip().splitlines()) == 2  # header + 1
    # Sans filtre : 2 lignes data (isolation tenant).
    full = await transactions_csv(db_session, seed_company.id)
    assert len(full.strip().splitlines()) == 3


# ── TVA par transaction ─────────────────────────────────────────────────────


def test_compute_line_vat_treatments() -> None:
    from app.routers.finance.service import compute_line_vat

    assert compute_line_vat(Decimal("1000"), "standard") == Decimal("50.00")
    assert compute_line_vat(Decimal("1000"), "zero_rated") == Decimal("0.00")
    assert compute_line_vat(Decimal("1000"), "exempt") == Decimal("0.00")


async def test_create_transaction_stores_vat(db_session, seed_company: Company) -> None:
    std = await create_transaction(
        db_session,
        seed_company.id,
        _txn(type="commission", direction="credit", amount=Decimal("1000")),
    )
    assert std.tax_treatment == "standard"
    assert std.vat_amount == Decimal("50.00")

    zero = await create_transaction(
        db_session,
        seed_company.id,
        TransactionCreate(
            type="commission",
            direction="credit",
            amount=Decimal("1000"),
            tax_treatment="zero_rated",
        ),
    )
    assert zero.vat_amount == Decimal("0.00")


async def test_vat_report_excludes_zero_rated_from_vat(db_session, seed_company: Company) -> None:
    cid = seed_company.id
    rev = await create_transaction(
        db_session, cid, _txn(type="commission", direction="credit", amount=Decimal("20000"))
    )
    await update_transaction(db_session, cid, rev.id, TransactionUpdate(status="paid"))
    exp = await create_transaction(
        db_session, cid, _txn(type="expense", direction="debit", amount=Decimal("8000"))
    )
    await update_transaction(db_session, cid, exp.id, TransactionUpdate(status="paid"))
    # Revenu zéro-rated : pas de TVA collectée, exclu de la base taxable.
    zr = await create_transaction(
        db_session,
        cid,
        TransactionCreate(
            type="payment", direction="credit", amount=Decimal("5000"), tax_treatment="zero_rated"
        ),
    )
    await update_transaction(db_session, cid, zr.id, TransactionUpdate(status="paid"))

    vat = await get_vat_report(db_session, cid, "ytd")
    assert vat.output_vat == Decimal("1000.00")  # 5% de 20000 seulement
    assert vat.input_vat == Decimal("400.00")
    assert vat.net_vat == Decimal("600.00")
    assert vat.taxable_revenue == Decimal("20000")  # zéro-rated exclu de la base


# ── Factures PDF ────────────────────────────────────────────────────────────


def test_build_invoice_html_contains_amounts() -> None:
    from datetime import date as _date

    from app.routers.finance.invoice import build_invoice_html

    out = build_invoice_html(
        reference="TXN-2026-00042",
        company_name="Infinity FM",
        issue_date=_date(2026, 6, 5),
        description="Commission vente Marina",
        amount_ht=Decimal("1000"),
        vat_rate=Decimal("0.05"),
        vat_amount=Decimal("50"),
    )
    assert "TXN-2026-00042" in out
    assert "AED 1,000.00" in out  # HT
    assert "AED 50.00" in out  # TVA
    assert "AED 1,050.00" in out  # TTC
    assert "Commission vente Marina" in out
    assert "5.00%" in out


def test_render_pdf_produces_pdf_bytes() -> None:
    pytest.importorskip("weasyprint")  # CI sans libs système → skip
    from app.routers.finance.invoice import render_pdf

    pdf = render_pdf("<html><body><h1>Test</h1></body></html>")
    assert pdf[:4] == b"%PDF"


async def test_generate_invoice_rejects_non_invoice(db_session, seed_company: Company) -> None:
    from app.routers.finance.invoice import InvoiceError, generate_and_store_invoice

    txn = await create_transaction(
        db_session, seed_company.id, _txn(type="payment", direction="credit")
    )
    with pytest.raises(InvoiceError) as exc:
        await generate_and_store_invoice(db_session, seed_company.id, txn.id)
    assert exc.value.code == "not_an_invoice"


async def test_generate_invoice_cross_tenant_not_found(db_session, seed_company: Company) -> None:
    from app.routers.finance.invoice import InvoiceError, generate_and_store_invoice

    other = await _other_company(db_session)
    txn = await create_transaction(db_session, seed_company.id, _txn(type="invoice"))
    with pytest.raises(InvoiceError) as exc:
        await generate_and_store_invoice(db_session, other.id, txn.id)
    assert exc.value.code == "transaction_not_found"


# ── Prévision de trésorerie ─────────────────────────────────────────────────


def test_bucket_cashflow() -> None:
    from datetime import date

    from app.routers.finance.service import bucket_cashflow

    today = date(2026, 6, 5)
    items = [
        (Decimal("1000"), date(2026, 6, 20), "credit"),  # +15 j → d0_30 in
        (Decimal("500"), date(2026, 5, 1), "debit"),  # passé → overdue out
        (Decimal("200"), date(2026, 8, 1), "credit"),  # +57 j → d31_60 in
        (Decimal("100"), None, "credit"),  # sans échéance → d0_30 in
    ]
    b = bucket_cashflow(items, today)
    assert b["d0_30"]["in"] == Decimal("1100")
    assert b["overdue"]["out"] == Decimal("500")
    assert b["d31_60"]["in"] == Decimal("200")


async def test_cash_flow_forecast_totals(db_session, seed_company: Company) -> None:
    from datetime import date

    from app.routers.finance.service import cash_flow_forecast

    cid = seed_company.id
    await create_transaction(
        db_session,
        cid,
        _txn(type="invoice", direction="credit", amount=Decimal("3000"), due_date=date(2026, 7, 1)),
    )
    await create_transaction(
        db_session,
        cid,
        _txn(type="expense", direction="debit", amount=Decimal("1000"), due_date=date(2026, 1, 1)),
    )
    fc = await cash_flow_forecast(db_session, cid)
    assert fc.total_in == Decimal("3000")
    assert fc.total_out == Decimal("1000")
    assert fc.net == Decimal("2000")


# ── Clôture de période ──────────────────────────────────────────────────────


async def test_close_period_and_duplicate(db_session, seed_company: Company) -> None:
    from datetime import date

    from app.routers.finance.closure import ClosureError, close_period, list_closures

    c = await close_period(db_session, seed_company.id, date(2026, 3, 31))
    assert c.period_end == date(2026, 3, 31)
    with pytest.raises(ClosureError) as exc:
        await close_period(db_session, seed_company.id, date(2026, 3, 31))
    assert exc.value.code == "period_already_closed"
    assert len(await list_closures(db_session, seed_company.id)) == 1


async def test_is_date_closed(db_session, seed_company: Company) -> None:
    from datetime import date

    from app.routers.finance.closure import close_period, is_date_closed

    assert await is_date_closed(db_session, seed_company.id, date(2026, 1, 1)) is False
    await close_period(db_session, seed_company.id, date(2026, 6, 30))
    assert await is_date_closed(db_session, seed_company.id, date(2026, 6, 1)) is True
    assert await is_date_closed(db_session, seed_company.id, date(2026, 7, 1)) is False


async def test_update_blocked_in_closed_period(db_session, seed_company: Company) -> None:
    from datetime import date

    from app.routers.finance.closure import PeriodClosedError, close_period

    txn = await create_transaction(db_session, seed_company.id, _txn(type="invoice"))
    await close_period(db_session, seed_company.id, date(2026, 12, 31))  # couvre created_at
    with pytest.raises(PeriodClosedError):
        await update_transaction(
            db_session, seed_company.id, txn.id, TransactionUpdate(status="paid")
        )


# ── Échéancier & relances (dunning) ────────────────────────────────────────


def test_days_overdue_and_level() -> None:
    from datetime import date

    from app.routers.finance.dunning import days_overdue, dunning_level

    today = date(2026, 6, 20)
    assert days_overdue(None, today) == 0
    assert days_overdue(date(2026, 6, 25), today) == 0  # futur
    assert days_overdue(date(2026, 6, 19), today) == 1
    assert days_overdue(date(2026, 6, 5), today) == 15

    assert dunning_level(0) == 0
    assert dunning_level(1) == 1
    assert dunning_level(6) == 1
    assert dunning_level(7) == 2
    assert dunning_level(14) == 2
    assert dunning_level(15) == 3
    assert dunning_level(99) == 3


def test_should_escalate() -> None:
    from app.routers.finance.dunning import should_escalate

    assert should_escalate(2, 1) is True  # niveau monté
    assert should_escalate(1, 1) is False  # déjà relancé à ce niveau
    assert should_escalate(0, 0) is False  # pas en retard
    assert should_escalate(3, 1) is True


def test_client_name_and_message_helpers() -> None:
    from app.routers.finance.dunning import _client_name, _reminder_message

    assert _client_name(None) is None
    msg = _reminder_message("INV-1", 3, Decimal("1000"), "AED")
    assert "INV-1" in msg and "1000" in msg and "AED" in msg


async def test_list_overdue_detail_and_levels(db_session, seed_company: Company) -> None:
    from datetime import date, timedelta

    from app.routers.finance.dunning import list_overdue

    today = date(2026, 6, 20)
    cid = seed_company.id
    # Facture échue depuis 10 jours → niveau 2.
    await create_transaction(
        db_session,
        cid,
        _txn(
            type="invoice",
            direction="credit",
            amount=Decimal("500"),
            due_date=today - timedelta(days=10),
        ),
    )
    # Facture pas encore échue → niveau 0 mais présente (pending).
    await create_transaction(
        db_session,
        cid,
        _txn(
            type="invoice",
            direction="credit",
            amount=Decimal("200"),
            due_date=today + timedelta(days=5),
        ),
    )
    rows = await list_overdue(db_session, cid, today)
    assert len(rows) == 2
    by_amount = {r["amount"]: r for r in rows}
    assert by_amount[Decimal("500.00")]["days_overdue"] == 10
    assert by_amount[Decimal("500.00")]["level"] == 2
    assert by_amount[Decimal("200.00")]["days_overdue"] == 0
    assert by_amount[Decimal("200.00")]["level"] == 0


async def test_send_reminder_records_event(db_session, seed_company: Company) -> None:
    from datetime import date, timedelta

    from app.routers.finance.dunning import list_overdue, send_reminder

    today = date(2026, 6, 20)
    cid = seed_company.id
    txn = await create_transaction(
        db_session,
        cid,
        _txn(
            type="invoice",
            direction="credit",
            amount=Decimal("900"),
            due_date=today - timedelta(days=8),
        ),
    )
    event = await send_reminder(db_session, cid, txn.id, "email", today)
    assert event.level == 2
    assert event.channel == "email"
    # Le résumé de l'échéancier reflète la relance envoyée.
    rows = await list_overdue(db_session, cid, today)
    row = next(r for r in rows if r["id"] == txn.id)
    assert row["reminders_sent"] == 1
    assert row["last_reminder_level"] == 2


async def test_send_reminder_rejects_not_overdue(db_session, seed_company: Company) -> None:
    from datetime import date, timedelta

    from app.routers.finance.dunning import DunningError, send_reminder

    today = date(2026, 6, 20)
    cid = seed_company.id
    txn = await create_transaction(
        db_session,
        cid,
        _txn(
            type="invoice",
            direction="credit",
            amount=Decimal("100"),
            due_date=today + timedelta(days=3),
        ),
    )
    with pytest.raises(DunningError) as exc:
        await send_reminder(db_session, cid, txn.id, "email", today)
    assert exc.value.code == "not_overdue"


async def test_send_reminder_invalid_channel_and_not_found(
    db_session, seed_company: Company
) -> None:
    from datetime import date

    from app.routers.finance.dunning import DunningError, send_reminder

    cid = seed_company.id
    with pytest.raises(DunningError) as exc:
        await send_reminder(db_session, cid, uuid.uuid4(), "sms", date(2026, 6, 20))
    assert exc.value.code == "invalid_channel"
    with pytest.raises(DunningError) as exc2:
        await send_reminder(db_session, cid, uuid.uuid4(), "email", date(2026, 6, 20))
    assert exc2.value.code == "transaction_not_found"


async def test_dunning_cross_tenant_isolation(db_session, seed_company: Company) -> None:
    from datetime import date, timedelta

    from app.routers.finance.dunning import DunningError, list_overdue, send_reminder

    today = date(2026, 6, 20)
    cid = seed_company.id
    txn = await create_transaction(
        db_session,
        cid,
        _txn(
            type="invoice",
            direction="credit",
            amount=Decimal("700"),
            due_date=today - timedelta(days=20),
        ),
    )
    other = await _other_company(db_session)
    # L'autre tenant ne voit pas la facture et ne peut pas la relancer (Loi 1).
    assert await list_overdue(db_session, other.id, today) == []
    with pytest.raises(DunningError) as exc:
        await send_reminder(db_session, other.id, txn.id, "email", today)
    assert exc.value.code == "transaction_not_found"
