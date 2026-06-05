"""Service — Finance. Toujours filtrer par company_id (Loi 1)."""

import csv
import io
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinanceTransaction
from app.routers.finance.closure import PeriodClosedError, is_date_closed
from app.routers.finance.schemas import (
    AgedBuckets,
    AgedReceivables,
    CashFlowBucket,
    CashFlowForecast,
    FinanceSummary,
    PnlReport,
    TransactionCreate,
    TransactionUpdate,
    VatReport,
)

Period = Literal["month", "quarter", "ytd"]


async def _next_transaction_sequence(db: AsyncSession, year: int) -> int:
    """Calcule le prochain numéro de séquence pour les références de transaction."""
    prefix = f"TXN-{year}-"
    result = await db.execute(
        select(func.count(FinanceTransaction.id)).where(
            FinanceTransaction.reference.like(f"{prefix}%")
        )
    )
    count: int = result.scalar_one()
    return count + 1


async def list_transactions(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    type_: str | None = None,
    status: str | None = None,
    direction: str | None = None,
) -> tuple[list[FinanceTransaction], int]:
    """Retourne la liste paginée des transactions du tenant."""
    base_query = select(FinanceTransaction).where(
        FinanceTransaction.company_id == company_id,
        FinanceTransaction.deleted_at.is_(None),
    )

    if type_:
        base_query = base_query.where(FinanceTransaction.type == type_)
    if status:
        base_query = base_query.where(FinanceTransaction.status == status)
    if direction:
        base_query = base_query.where(FinanceTransaction.direction == direction)

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total: int = total_result.scalar_one()

    offset = (page - 1) * limit
    paginated_query = (
        base_query.order_by(FinanceTransaction.created_at.desc()).offset(offset).limit(limit)
    )
    result = await db.execute(paginated_query)
    transactions = list(result.scalars().all())

    return transactions, total


async def get_transaction(
    db: AsyncSession,
    company_id: uuid.UUID,
    txn_id: uuid.UUID,
) -> FinanceTransaction | None:
    """Récupère une transaction par son ID dans le tenant courant."""
    result = await db.execute(
        select(FinanceTransaction).where(
            FinanceTransaction.id == txn_id,
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_transaction(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: TransactionCreate,
) -> FinanceTransaction:
    """Crée une transaction financière avec référence auto-générée."""
    now = datetime.now(UTC)
    year = now.year
    seq = await _next_transaction_sequence(db, year)
    reference = f"TXN-{year}-{seq:05d}"

    vat_amount = compute_line_vat(data.amount, data.tax_treatment, data.vat_rate)

    txn = FinanceTransaction(
        company_id=company_id,
        reference=reference,
        type=data.type,
        direction=data.direction,
        amount=data.amount,
        currency=data.currency,
        tax_treatment=data.tax_treatment,
        vat_rate=data.vat_rate,
        vat_amount=vat_amount,
        status="pending",
        description_en=data.description_en,
        description_ar=data.description_ar,
        description_fr=data.description_fr,
        related_contract_id=data.related_contract_id,
        related_client_id=data.related_client_id,
        related_property_id=data.related_property_id,
        due_date=data.due_date,
        payment_method=data.payment_method,
        bank_reference=data.bank_reference,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


async def update_transaction(
    db: AsyncSession,
    company_id: uuid.UUID,
    txn_id: uuid.UUID,
    data: TransactionUpdate,
) -> FinanceTransaction | None:
    """
    Met à jour une transaction.
    - status → "paid" sans paid_at fourni : positionne paid_at = now()
    """
    txn = await get_transaction(db, company_id, txn_id)
    if not txn:
        return None

    # Verrou de clôture : une transaction d'une période clôturée est immuable.
    if await is_date_closed(db, company_id, txn.created_at.date()):
        raise PeriodClosedError()

    update_data = data.model_dump(exclude_unset=True)

    now = datetime.now(UTC)
    if update_data.get("status") == "paid" and not update_data.get("paid_at"):
        update_data["paid_at"] = now

    for field, value in update_data.items():
        setattr(txn, field, value)

    txn.updated_at = now
    await db.commit()
    await db.refresh(txn)
    return txn


async def get_summary(
    db: AsyncSession,
    company_id: uuid.UUID,
) -> FinanceSummary:
    """
    Calcule les KPIs financiers du tenant via des agrégations SQL.
    - Revenus : transactions credit + paid
    - Dépenses : transactions debit + paid
    - Factures en attente
    - Montant payé ce mois
    """
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Revenus totaux (credit, paid)
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.direction == "credit",
            FinanceTransaction.status == "paid",
        )
    )
    total_revenue = Decimal(str(revenue_result.scalar_one()))

    # Dépenses totales (debit, paid)
    expenses_result = await db.execute(
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.direction == "debit",
            FinanceTransaction.status == "paid",
        )
    )
    total_expenses = Decimal(str(expenses_result.scalar_one()))

    # Factures en attente (type=invoice, status=pending)
    pending_count_result = await db.execute(
        select(func.count(FinanceTransaction.id)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.type == "invoice",
            FinanceTransaction.status == "pending",
        )
    )
    pending_invoices: int = pending_count_result.scalar_one()

    pending_amount_result = await db.execute(
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.type == "invoice",
            FinanceTransaction.status == "pending",
        )
    )
    pending_amount = Decimal(str(pending_amount_result.scalar_one()))

    # Montant payé ce mois
    paid_month_result = await db.execute(
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.status == "paid",
            FinanceTransaction.paid_at >= month_start,
        )
    )
    paid_this_month = Decimal(str(paid_month_result.scalar_one()))

    return FinanceSummary(
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        net=total_revenue - total_expenses,
        pending_invoices=pending_invoices,
        pending_amount=pending_amount,
        paid_this_month=paid_this_month,
    )


# ── Rapports financiers (P&L + balance âgée) ──────────────────────────────


def period_start(period: Period, now: datetime) -> datetime:
    """Début de la période demandée (mois courant / trimestre / année)."""
    base = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "ytd":
        return base.replace(month=1, day=1)
    if period == "quarter":
        q_first_month = ((now.month - 1) // 3) * 3 + 1
        return base.replace(month=q_first_month, day=1)
    return base.replace(day=1)  # month


def bucket_receivables(items: list[tuple[Decimal, date | None]], today: date) -> dict[str, Decimal]:
    """Ventile des créances (montant, échéance) par âge d'impayé.

    Pure (testable). Pas d'échéance ou échéance future → `current` ; sinon par
    tranches de retard 1-30 / 31-60 / 61-90 / 90+ jours."""
    buckets: dict[str, Decimal] = {
        "current": Decimal(0),
        "d1_30": Decimal(0),
        "d31_60": Decimal(0),
        "d61_90": Decimal(0),
        "d90plus": Decimal(0),
    }
    for amount, due in items:
        amt = Decimal(str(amount))
        if due is None or due >= today:
            buckets["current"] += amt
            continue
        days = (today - due).days
        if days <= 30:
            buckets["d1_30"] += amt
        elif days <= 60:
            buckets["d31_60"] += amt
        elif days <= 90:
            buckets["d61_90"] += amt
        else:
            buckets["d90plus"] += amt
    return buckets


async def get_pnl(db: AsyncSession, company_id: uuid.UUID, period: Period) -> PnlReport:
    """Compte de résultat : revenus/dépenses encaissés par type sur la période."""
    start = period_start(period, datetime.now(UTC))

    async def _by_type(direction: str) -> dict[str, Decimal]:
        rows = (
            await db.execute(
                select(
                    FinanceTransaction.type,
                    func.coalesce(func.sum(FinanceTransaction.amount), 0),
                )
                .where(
                    FinanceTransaction.company_id == company_id,
                    FinanceTransaction.deleted_at.is_(None),
                    FinanceTransaction.direction == direction,
                    FinanceTransaction.status == "paid",
                    FinanceTransaction.paid_at >= start,
                )
                .group_by(FinanceTransaction.type)
            )
        ).all()
        return {t: Decimal(str(amt)) for t, amt in rows}

    revenue_by_type = await _by_type("credit")
    expense_by_type = await _by_type("debit")
    total_revenue = sum(revenue_by_type.values(), Decimal(0))
    total_expenses = sum(expense_by_type.values(), Decimal(0))
    return PnlReport(
        period=period,
        revenue_by_type=revenue_by_type,
        expense_by_type=expense_by_type,
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        net=total_revenue - total_expenses,
    )


async def get_aged_receivables(db: AsyncSession, company_id: uuid.UUID) -> AgedReceivables:
    """Balance âgée des factures impayées (pending/overdue) par tranche de retard."""
    rows = (
        await db.execute(
            select(FinanceTransaction.amount, FinanceTransaction.due_date).where(
                FinanceTransaction.company_id == company_id,
                FinanceTransaction.deleted_at.is_(None),
                FinanceTransaction.type == "invoice",
                FinanceTransaction.status.in_(("pending", "overdue")),
            )
        )
    ).all()
    items: list[tuple[Decimal, date | None]] = [(amt, due) for amt, due in rows]
    buckets = bucket_receivables(items, datetime.now(UTC).date())
    total = sum(buckets.values(), Decimal(0))
    return AgedReceivables(buckets=AgedBuckets(**buckets), total=total, count=len(items))


# ── TVA (UAE) — par transaction (vat_amount stocké) ────────────────────────

VAT_RATE = Decimal("0.05")  # taux standard UAE par défaut


def compute_line_vat(amount: Decimal, tax_treatment: str, rate: Decimal = VAT_RATE) -> Decimal:
    """TVA d'une transaction (pure, testable). 0 si zero_rated/exempt ; sinon
    amount × rate arrondi à 2 décimales. `amount` est supposé HT."""
    if tax_treatment in ("zero_rated", "exempt"):
        return Decimal("0.00")
    return (amount * rate).quantize(Decimal("0.01"))


def compute_vat(
    taxable_revenue: Decimal, taxable_expenses: Decimal, rate: Decimal = VAT_RATE
) -> dict[str, Decimal]:
    """TVA collectée/déductible/nette dérivée (pure, testable, montants HT).

    Conservé pour compat ; le rapport officiel agrège désormais vat_amount stocké."""
    q = Decimal("0.01")
    output_vat = (taxable_revenue * rate).quantize(q)
    input_vat = (taxable_expenses * rate).quantize(q)
    return {
        "output_vat": output_vat,
        "input_vat": input_vat,
        "net_vat": output_vat - input_vat,
    }


async def get_vat_report(
    db: AsyncSession, company_id: uuid.UUID, period: Period, rate: Decimal = VAT_RATE
) -> VatReport:
    """Rapport TVA de la période sur les transactions encaissées (paid), agrégeant
    la **TVA réelle stockée** par transaction (vat_amount). Base taxable = montant
    HT des transactions standard-rated."""
    start = period_start(period, datetime.now(UTC))

    async def _sum(column, direction: str, standard_only: bool = False) -> Decimal:  # type: ignore[no-untyped-def]
        stmt = select(func.coalesce(func.sum(column), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.direction == direction,
            FinanceTransaction.status == "paid",
            FinanceTransaction.paid_at >= start,
        )
        if standard_only:
            stmt = stmt.where(FinanceTransaction.tax_treatment == "standard")
        res = await db.execute(stmt)
        return Decimal(str(res.scalar_one()))

    output_vat = await _sum(FinanceTransaction.vat_amount, "credit")
    input_vat = await _sum(FinanceTransaction.vat_amount, "debit")
    taxable_revenue = await _sum(FinanceTransaction.amount, "credit", standard_only=True)
    taxable_expenses = await _sum(FinanceTransaction.amount, "debit", standard_only=True)
    return VatReport(
        period=period,
        rate=rate,
        taxable_revenue=taxable_revenue,
        taxable_expenses=taxable_expenses,
        output_vat=output_vat,
        input_vat=input_vat,
        net_vat=output_vat - input_vat,
    )


# ── Export comptable (CSV) ────────────────────────────────────────────────

CSV_COLUMNS = (
    "reference",
    "date",
    "type",
    "direction",
    "amount",
    "currency",
    "status",
    "due_date",
    "paid_at",
    "description",
)


async def transactions_csv(
    db: AsyncSession,
    company_id: uuid.UUID,
    type_: str | None = None,
    status: str | None = None,
    direction: str | None = None,
) -> str:
    """Export CSV des transactions du tenant (filtres optionnels), ordre antéchrono.

    Description = 1re valeur non vide parmi fr/en/ar. Montants bruts (point décimal)."""
    query = select(FinanceTransaction).where(
        FinanceTransaction.company_id == company_id,
        FinanceTransaction.deleted_at.is_(None),
    )
    if type_:
        query = query.where(FinanceTransaction.type == type_)
    if status:
        query = query.where(FinanceTransaction.status == status)
    if direction:
        query = query.where(FinanceTransaction.direction == direction)
    query = query.order_by(FinanceTransaction.created_at.desc())
    rows = (await db.execute(query)).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_COLUMNS)
    for t in rows:
        desc = t.description_fr or t.description_en or t.description_ar or ""
        writer.writerow(
            [
                t.reference,
                t.created_at.date().isoformat() if t.created_at else "",
                t.type,
                t.direction,
                f"{t.amount:.2f}",
                t.currency,
                t.status,
                t.due_date.isoformat() if t.due_date else "",
                t.paid_at.isoformat() if t.paid_at else "",
                desc,
            ]
        )
    return buf.getvalue()


# ── Prévision de trésorerie (cash-flow) ─────────────────────────────────────

CASHFLOW_LABELS = ("overdue", "d0_30", "d31_60", "d61_90", "later")


def bucket_cashflow(
    items: list[tuple[Decimal, date | None, str]], today: date
) -> dict[str, dict[str, Decimal]]:
    """Ventile des flux attendus (montant, échéance, direction) par tranche.

    Pur (testable). direction 'credit' = encaissement (in), 'debit' = décaissement
    (out). Échéance passée → 'overdue' ; pas d'échéance → 'd0_30' (court terme)."""
    result: dict[str, dict[str, Decimal]] = {
        label: {"in": Decimal(0), "out": Decimal(0)} for label in CASHFLOW_LABELS
    }
    for amount, due, direction in items:
        amt = Decimal(str(amount))
        if due is None:
            label = "d0_30"
        else:
            delta = (due - today).days
            if delta < 0:
                label = "overdue"
            elif delta <= 30:
                label = "d0_30"
            elif delta <= 60:
                label = "d31_60"
            elif delta <= 90:
                label = "d61_90"
            else:
                label = "later"
        result[label]["in" if direction == "credit" else "out"] += amt
    return result


async def cash_flow_forecast(db: AsyncSession, company_id: uuid.UUID) -> CashFlowForecast:
    """Prévision de trésorerie : transactions non réglées (pending/overdue) ventilées
    par tranche d'échéance, encaissements (credit) vs décaissements (debit)."""
    rows = (
        await db.execute(
            select(
                FinanceTransaction.amount,
                FinanceTransaction.due_date,
                FinanceTransaction.direction,
            ).where(
                FinanceTransaction.company_id == company_id,
                FinanceTransaction.deleted_at.is_(None),
                FinanceTransaction.status.in_(("pending", "overdue")),
            )
        )
    ).all()
    items: list[tuple[Decimal, date | None, str]] = [
        (amt, due, direction) for amt, due, direction in rows
    ]
    buckets_map = bucket_cashflow(items, datetime.now(UTC).date())
    buckets = [
        CashFlowBucket(
            label=label,
            expected_in=buckets_map[label]["in"],
            expected_out=buckets_map[label]["out"],
            net=buckets_map[label]["in"] - buckets_map[label]["out"],
        )
        for label in CASHFLOW_LABELS
    ]
    total_in = sum((b.expected_in for b in buckets), Decimal(0))
    total_out = sum((b.expected_out for b in buckets), Decimal(0))
    return CashFlowForecast(
        buckets=buckets, total_in=total_in, total_out=total_out, net=total_in - total_out
    )
