"""Service — Rapprochement bancaire. Toujours filtrer par company_id (Loi 1).

Une ligne de relevé (`amount` SIGNÉ) se rapproche d'une transaction finance de
même |montant| et de direction cohérente (crédit si entrée, débit si sortie),
dans une fenêtre de dates. Le rapprochement pose `matched_transaction_id` +
`status='reconciled'`.
"""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank import BankAccount, BankStatementLine
from app.models.finance import FinanceTransaction
from app.routers.bank.schemas import (
    BankAccountCreate,
    ImportLineRow,
    MatchSuggestion,
    ReconSummary,
    StatementLineCreate,
)

_ZERO = Decimal("0")
# Fenêtre de tolérance (jours) entre date de valeur et date de la transaction.
MATCH_DATE_WINDOW_DAYS = 7


class BankError(ValueError):
    """Erreur métier rapprochement bancaire (code lisible pour le router)."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


# ── Helper PUR ───────────────────────────────────────────────────────────────


def expected_direction(amount: Decimal) -> str:
    """Direction finance attendue pour un montant de relevé signé.

    Entrée d'argent (montant > 0) → 'credit' ; sortie (< 0) → 'debit'.
    Lève BankError si montant nul (une ligne de relevé doit avoir un montant)."""
    if amount > 0:
        return "credit"
    if amount < 0:
        return "debit"
    raise BankError("amount_must_be_nonzero")


def _txn_date(txn: FinanceTransaction):  # type: ignore[no-untyped-def]
    """Date de référence d'une transaction pour le rapprochement."""
    if txn.paid_at is not None:
        return txn.paid_at.date()
    if txn.due_date is not None:
        return txn.due_date
    return txn.created_at.date()


# ── Comptes bancaires ────────────────────────────────────────────────────────


async def create_bank_account(
    db: AsyncSession, company_id: uuid.UUID, data: BankAccountCreate
) -> BankAccount:
    account = BankAccount(
        company_id=company_id,
        name=data.name,
        account_number=data.account_number,
        currency=data.currency,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_bank_account(
    db: AsyncSession, company_id: uuid.UUID, account_id: uuid.UUID
) -> BankAccount | None:
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == account_id,
            BankAccount.company_id == company_id,
            BankAccount.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_bank_accounts(
    db: AsyncSession, company_id: uuid.UUID, *, page: int = 1, limit: int = 50
) -> tuple[list[BankAccount], int]:
    base = select(BankAccount).where(
        BankAccount.company_id == company_id, BankAccount.deleted_at.is_(None)
    )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (await db.execute(base.order_by(BankAccount.name).offset((page - 1) * limit).limit(limit)))
        .scalars()
        .all()
    )
    return list(rows), total


# ── Lignes de relevé ─────────────────────────────────────────────────────────


async def create_statement_line(
    db: AsyncSession, company_id: uuid.UUID, data: StatementLineCreate
) -> BankStatementLine:
    if data.amount == _ZERO:
        raise BankError("amount_must_be_nonzero")
    account = await get_bank_account(db, company_id, data.bank_account_id)
    if account is None:
        raise BankError("bank_account_not_found")
    line = BankStatementLine(
        company_id=company_id,
        bank_account_id=data.bank_account_id,
        value_date=data.value_date,
        label=data.label,
        amount=data.amount,
        status="unreconciled",
    )
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return line


async def get_statement_line(
    db: AsyncSession, company_id: uuid.UUID, line_id: uuid.UUID
) -> BankStatementLine | None:
    result = await db.execute(
        select(BankStatementLine).where(
            BankStatementLine.id == line_id,
            BankStatementLine.company_id == company_id,
            BankStatementLine.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_statement_lines(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    bank_account_id: uuid.UUID | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> tuple[list[BankStatementLine], int]:
    base = select(BankStatementLine).where(
        BankStatementLine.company_id == company_id,
        BankStatementLine.deleted_at.is_(None),
    )
    if bank_account_id is not None:
        base = base.where(BankStatementLine.bank_account_id == bank_account_id)
    if status:
        base = base.where(BankStatementLine.status == status)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                base.order_by(BankStatementLine.value_date.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


# ── Rapprochement ────────────────────────────────────────────────────────────


async def _matched_transaction_ids(db: AsyncSession, company_id: uuid.UUID) -> set[uuid.UUID]:
    """IDs de transactions déjà rapprochées à une ligne (pour exclure des suggestions)."""
    result = await db.execute(
        select(BankStatementLine.matched_transaction_id).where(
            BankStatementLine.company_id == company_id,
            BankStatementLine.deleted_at.is_(None),
            BankStatementLine.matched_transaction_id.is_not(None),
        )
    )
    return {row for row in result.scalars().all() if row is not None}


async def suggest_matches(
    db: AsyncSession, company_id: uuid.UUID, line: BankStatementLine
) -> list[MatchSuggestion]:
    """Transactions finance candidates pour une ligne : même |montant|, direction
    cohérente, non annulées, non déjà rapprochées, dans la fenêtre de dates."""
    direction = expected_direction(line.amount)
    target = abs(line.amount)
    result = await db.execute(
        select(FinanceTransaction).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.direction == direction,
            FinanceTransaction.amount == target,
            FinanceTransaction.status != "cancelled",
        )
    )
    candidates = list(result.scalars().all())
    taken = await _matched_transaction_ids(db, company_id)
    window = timedelta(days=MATCH_DATE_WINDOW_DAYS)
    out: list[MatchSuggestion] = []
    for txn in candidates:
        if txn.id in taken:
            continue
        if abs((_txn_date(txn) - line.value_date).days) > window.days:
            continue
        out.append(
            MatchSuggestion(
                transaction_id=txn.id,
                reference=txn.reference,
                amount=txn.amount,
                direction=txn.direction,
                status=txn.status,
                due_date=txn.due_date,
                paid_at=txn.paid_at,
            )
        )
    return out


async def match_line(
    db: AsyncSession, company_id: uuid.UUID, line_id: uuid.UUID, transaction_id: uuid.UUID
) -> BankStatementLine | None:
    """Rapproche une ligne à une transaction finance (montant + direction cohérents,
    transaction non déjà rapprochée). Retourne None si la ligne n'existe pas."""
    line = await get_statement_line(db, company_id, line_id)
    if line is None:
        return None

    txn_result = await db.execute(
        select(FinanceTransaction).where(
            FinanceTransaction.id == transaction_id,
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
        )
    )
    txn = txn_result.scalar_one_or_none()
    if txn is None:
        raise BankError("transaction_not_found")
    if txn.amount != abs(line.amount) or txn.direction != expected_direction(line.amount):
        raise BankError("match_amount_mismatch")

    taken = await _matched_transaction_ids(db, company_id)
    if transaction_id in taken and line.matched_transaction_id != transaction_id:
        raise BankError("transaction_already_matched")

    line.matched_transaction_id = transaction_id
    line.status = "reconciled"
    line.matched_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(line)
    return line


async def unmatch_line(
    db: AsyncSession, company_id: uuid.UUID, line_id: uuid.UUID
) -> BankStatementLine | None:
    line = await get_statement_line(db, company_id, line_id)
    if line is None:
        return None
    line.matched_transaction_id = None
    line.status = "unreconciled"
    line.matched_at = None
    await db.commit()
    await db.refresh(line)
    return line


async def reconciliation_summary(
    db: AsyncSession, company_id: uuid.UUID, bank_account_id: uuid.UUID
) -> ReconSummary:
    """Synthèse de rapprochement d'un compte : compteurs + montants par statut."""
    result = await db.execute(
        select(
            BankStatementLine.status,
            func.count(BankStatementLine.id),
            func.coalesce(func.sum(BankStatementLine.amount), 0),
        )
        .where(
            BankStatementLine.company_id == company_id,
            BankStatementLine.bank_account_id == bank_account_id,
            BankStatementLine.deleted_at.is_(None),
        )
        .group_by(BankStatementLine.status)
    )
    counts = {"reconciled": 0, "unreconciled": 0}
    amounts = {"reconciled": _ZERO, "unreconciled": _ZERO}
    for status, count, total in result.all():
        if status in counts:
            counts[status] = int(count)
            amounts[status] = Decimal(str(total))
    return ReconSummary(
        reconciled_count=counts["reconciled"],
        unreconciled_count=counts["unreconciled"],
        reconciled_amount=amounts["reconciled"],
        unreconciled_amount=amounts["unreconciled"],
    )


# ── Import CSV + auto-rapprochement ──────────────────────────────────────────


async def import_statement_lines(
    db: AsyncSession,
    company_id: uuid.UUID,
    bank_account_id: uuid.UUID,
    rows: list[ImportLineRow],
) -> int:
    """Crée en masse des lignes de relevé (import CSV). Ignore les montants nuls.

    Retourne le nombre de lignes créées. Lève si le compte n'est pas du tenant."""
    account = await get_bank_account(db, company_id, bank_account_id)
    if account is None:
        raise BankError("bank_account_not_found")
    created = 0
    for row in rows:
        if row.amount == _ZERO:
            continue
        db.add(
            BankStatementLine(
                company_id=company_id,
                bank_account_id=bank_account_id,
                value_date=row.value_date,
                label=row.label,
                amount=row.amount,
                status="unreconciled",
            )
        )
        created += 1
    await db.commit()
    return created


async def auto_match(db: AsyncSession, company_id: uuid.UUID, bank_account_id: uuid.UUID) -> int:
    """Rapproche automatiquement les lignes non rapprochées ayant EXACTEMENT une
    suggestion. Retourne le nombre de rapprochements effectués.

    Re-fetch chaque ligne (évite les objets expirés après commit du match précédent)."""
    account = await get_bank_account(db, company_id, bank_account_id)
    if account is None:
        raise BankError("bank_account_not_found")
    lines, _ = await list_statement_lines(
        db, company_id, bank_account_id=bank_account_id, status="unreconciled", limit=1000
    )
    line_ids = [line.id for line in lines]
    matched = 0
    for line_id in line_ids:
        line = await get_statement_line(db, company_id, line_id)
        if line is None or line.status != "unreconciled":
            continue
        suggestions = await suggest_matches(db, company_id, line)
        if len(suggestions) == 1:
            await match_line(db, company_id, line_id, suggestions[0].transaction_id)
            matched += 1
    return matched
