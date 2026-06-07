"""Service — Relevés propriétaires (M6).

Helpers métier purs (sans DB) en tête ; génération/persistance ensuite.
Toujours filtrer par company_id (Loi 1).
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.owner_statement import OwnerStatement
from app.models.party_owner import Owner
from app.models.payment import PaymentRequest

# Types de paiement comptés comme revenu brut / comme dépense déductible.
REVENUE_TYPES: frozenset[str] = frozenset({"rent"})
EXPENSE_TYPES: frozenset[str] = frozenset({"charges"})


# ─── Helpers métier purs ──────────────────────────────────────────────────


def is_valid_period(year: int, month: int) -> bool:
    return 2000 <= year <= 2100 and 1 <= month <= 12


def statement_period_label(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def compute_commission(gross: Decimal, rate_pct: Decimal) -> Decimal:
    """Commission de gestion = revenu brut × taux%, arrondie à 2 décimales."""
    return (gross * rate_pct / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def net_payout(gross: Decimal, expenses: Decimal, commission: Decimal) -> Decimal:
    """Payout net dû au propriétaire = brut − dépenses − commission."""
    return (gross - expenses - commission).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _period_bounds(year: int, month: int) -> tuple[date, date]:
    """Premier et dernier jour du mois (inclusifs)."""
    start = date(year, month, 1)
    if month == 12:
        end = date(year, 12, 31)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return start, end


# ─── Génération / persistance ──────────────────────────────────────────────


async def _aggregate_period(
    db: AsyncSession,
    company_id: uuid.UUID,
    owner_client_id: uuid.UUID,
    year: int,
    month: int,
) -> tuple[Decimal, Decimal, list[dict[str, Any]]]:
    """Agrège les paiements 'paid' du propriétaire sur la période (par due_date).

    Retourne (revenu_brut, dépenses, line_items).
    """
    start, end = _period_bounds(year, month)
    rows = (
        await db.execute(
            select(
                PaymentRequest.reference,
                PaymentRequest.payment_type,
                PaymentRequest.amount_aed,
                PaymentRequest.status,
            ).where(
                PaymentRequest.company_id == company_id,
                PaymentRequest.owner_client_id == owner_client_id,
                PaymentRequest.deleted_at.is_(None),
                PaymentRequest.status == "paid",
                PaymentRequest.due_date >= start,
                PaymentRequest.due_date <= end,
            )
        )
    ).all()

    gross = Decimal("0")
    expenses = Decimal("0")
    line_items: list[dict[str, Any]] = []
    for ref, ptype, amount, status_val in rows:
        amt = Decimal(str(amount))
        if ptype in REVENUE_TYPES:
            gross += amt
        elif ptype in EXPENSE_TYPES:
            expenses += amt
        line_items.append(
            {"reference": ref, "type": ptype, "amount_aed": str(amt), "status": status_val}
        )
    return gross, expenses, line_items


async def get_owner(
    db: AsyncSession, company_id: uuid.UUID, owner_party_id: uuid.UUID
) -> Owner | None:
    result = await db.execute(
        select(Owner).where(
            Owner.party_id == owner_party_id,
            Owner.company_id == company_id,
            Owner.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_owner_email(
    db: AsyncSession, company_id: uuid.UUID, owner_party_id: uuid.UUID
) -> str | None:
    """E-mail du propriétaire (porté par le Client/party). Scopé tenant (Loi 1)."""
    result = await db.execute(
        select(Client.email).where(
            Client.id == owner_party_id,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_existing_statement(
    db: AsyncSession,
    company_id: uuid.UUID,
    owner_party_id: uuid.UUID,
    year: int,
    month: int,
) -> OwnerStatement | None:
    result = await db.execute(
        select(OwnerStatement).where(
            OwnerStatement.company_id == company_id,
            OwnerStatement.owner_party_id == owner_party_id,
            OwnerStatement.period_year == year,
            OwnerStatement.period_month == month,
        )
    )
    return result.scalar_one_or_none()


async def generate_statement(
    db: AsyncSession,
    company_id: uuid.UUID,
    owner: Owner,
    year: int,
    month: int,
) -> OwnerStatement:
    """Génère (ou régénère) le relevé du propriétaire pour la période."""
    gross, expenses, line_items = await _aggregate_period(
        db, company_id, owner.party_id, year, month
    )
    rate = Decimal(str(owner.mandate_commission_rate or 0))
    commission = compute_commission(gross, rate)
    net = net_payout(gross, expenses, commission)
    now = datetime.now(UTC)

    statement = await get_existing_statement(db, company_id, owner.party_id, year, month)
    if statement is None:
        statement = OwnerStatement(
            company_id=company_id,
            owner_party_id=owner.party_id,
            period_year=year,
            period_month=month,
        )
        db.add(statement)

    statement.gross_revenue_aed = gross
    statement.expenses_aed = expenses
    statement.commission_aed = commission
    statement.net_payout_aed = net
    statement.line_items = line_items
    statement.status = "draft"
    statement.generated_at = now
    statement.updated_at = now
    await db.commit()
    await db.refresh(statement)
    return statement


async def list_statements(
    db: AsyncSession, company_id: uuid.UUID, owner_party_id: uuid.UUID
) -> list[OwnerStatement]:
    result = await db.execute(
        select(OwnerStatement)
        .where(
            OwnerStatement.company_id == company_id,
            OwnerStatement.owner_party_id == owner_party_id,
        )
        .order_by(OwnerStatement.period_year.desc(), OwnerStatement.period_month.desc())
    )
    return list(result.scalars().all())


async def get_statement(
    db: AsyncSession, company_id: uuid.UUID, statement_id: uuid.UUID
) -> OwnerStatement | None:
    result = await db.execute(
        select(OwnerStatement).where(
            OwnerStatement.id == statement_id,
            OwnerStatement.company_id == company_id,
        )
    )
    return result.scalar_one_or_none()


async def mark_sent(db: AsyncSession, statement: OwnerStatement) -> OwnerStatement:
    statement.status = "sent"
    statement.sent_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(statement)
    return statement


async def count_statements(db: AsyncSession, company_id: uuid.UUID) -> int:
    return (
        await db.execute(
            select(func.count(OwnerStatement.id)).where(OwnerStatement.company_id == company_id)
        )
    ).scalar_one()
