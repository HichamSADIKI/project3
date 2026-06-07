"""Service — Comptabilité. Toujours filtrer par company_id (Loi 1).

Grand-livre en partie double : chaque écriture (JournalEntry) porte >= 2 lignes
équilibrées (somme débits == somme crédits). Les lignes stockent un company_id
DÉNORMALISÉ recopié de l'écriture parente — jamais depuis l'entrée client — pour
que la RLS s'applique directement à la table de lignes.
"""

import csv
import io
import uuid
from collections.abc import Iterable, Sequence
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import ChartAccount, JournalEntry, JournalLine
from app.routers.accounting.schemas import (
    AccountCreate,
    JournalEntryCreate,
    JournalLineIn,
    TrialBalance,
    TrialBalanceRow,
)

_ZERO = Decimal("0")


class AccountingError(ValueError):
    """Erreur métier comptabilité (code lisible pour le router)."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


# ── Helper PUR — validation d'équilibre (aucun accès DB) ────────────────────


def validate_balanced(lines: Sequence[JournalLineIn]) -> None:
    """Valide une liste de lignes d'écriture. Lève AccountingError si invalide.

    Règles (partie double) :
    - >= 2 lignes,
    - chaque ligne est débit XOR crédit (exactement un des deux > 0, l'autre == 0),
    - total des débits > 0,
    - somme(débits) == somme(crédits).
    Calcul 100 % Decimal (pas de float) pour éviter toute dérive.
    """
    if len(lines) < 2:
        raise AccountingError("entry_needs_two_lines")

    total_debit = _ZERO
    total_credit = _ZERO
    for line in lines:
        debit = Decimal(line.debit)
        credit = Decimal(line.credit)
        if debit < 0 or credit < 0:
            raise AccountingError("line_negative_amount")
        # XOR : exactement un côté strictement positif.
        if not ((debit > 0 and credit == 0) or (credit > 0 and debit == 0)):
            raise AccountingError("line_must_be_debit_xor_credit")
        total_debit += debit
        total_credit += credit

    if total_debit <= 0:
        raise AccountingError("entry_total_must_be_positive")
    if total_debit != total_credit:
        raise AccountingError("entry_not_balanced")


# ── Plan comptable ──────────────────────────────────────────────────────────


async def get_account(
    db: AsyncSession, company_id: uuid.UUID, account_id: uuid.UUID
) -> ChartAccount | None:
    """Récupère un compte du tenant courant (non supprimé)."""
    result = await db.execute(
        select(ChartAccount).where(
            ChartAccount.id == account_id,
            ChartAccount.company_id == company_id,
            ChartAccount.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _code_exists(db: AsyncSession, company_id: uuid.UUID, code: str) -> bool:
    result = await db.execute(
        select(func.count(ChartAccount.id)).where(
            ChartAccount.company_id == company_id,
            ChartAccount.code == code,
            ChartAccount.deleted_at.is_(None),
        )
    )
    return result.scalar_one() > 0


async def create_account(
    db: AsyncSession, company_id: uuid.UUID, data: AccountCreate
) -> ChartAccount:
    """Crée un compte. `code` unique par société ; `parent_id` doit être du même tenant."""
    if await _code_exists(db, company_id, data.code):
        raise AccountingError("account_code_exists")

    if data.parent_id is not None:
        parent = await get_account(db, company_id, data.parent_id)
        if parent is None:
            raise AccountingError("parent_not_found")

    account = ChartAccount(
        company_id=company_id,
        code=data.code,
        name_en=data.name_en,
        name_ar=data.name_ar,
        name_fr=data.name_fr,
        type=data.type,
        parent_id=data.parent_id,
        is_active=data.is_active,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def list_accounts(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    type_: str | None = None,
    is_active: bool | None = None,
    parent_id: uuid.UUID | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[ChartAccount], int]:
    """Liste paginée du plan comptable du tenant."""
    base = select(ChartAccount).where(
        ChartAccount.company_id == company_id,
        ChartAccount.deleted_at.is_(None),
    )
    if type_:
        base = base.where(ChartAccount.type == type_)
    if is_active is not None:
        base = base.where(ChartAccount.is_active.is_(is_active))
    if parent_id is not None:
        base = base.where(ChartAccount.parent_id == parent_id)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(ChartAccount.code).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return list(rows), total


# ── Écritures de journal ────────────────────────────────────────────────────


def format_reference(year: int, sequence: int) -> str:
    """Référence d'écriture JE-YYYY-NNNNN (séquence sur 5 chiffres)."""
    return f"JE-{year}-{sequence:05d}"


async def _next_entry_sequence(db: AsyncSession, company_id: uuid.UUID, year: int) -> int:
    """Prochain numéro de séquence d'écriture pour ce tenant et cette année.

    Verrou consultatif transactionnel (libéré au COMMIT) : sérialise les créations
    concurrentes du même tenant → COUNT+INSERT race-free (plus de collision de réf.).
    """
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
        {"k": f"ACCT:journal_entries:{company_id}:{year}"},
    )
    prefix = f"JE-{year}-"
    result = await db.execute(
        select(func.count(JournalEntry.id)).where(
            JournalEntry.company_id == company_id,
            JournalEntry.reference.like(f"{prefix}%"),
        )
    )
    return int(result.scalar_one()) + 1


async def _accounts_belong_to_company(
    db: AsyncSession, company_id: uuid.UUID, account_ids: Iterable[uuid.UUID]
) -> bool:
    """Vérifie que tous les comptes appartiennent au tenant (et ne sont pas supprimés)."""
    ids = set(account_ids)
    if not ids:
        return False
    result = await db.execute(
        select(func.count(ChartAccount.id)).where(
            ChartAccount.company_id == company_id,
            ChartAccount.deleted_at.is_(None),
            ChartAccount.id.in_(ids),
        )
    )
    return int(result.scalar_one()) == len(ids)


async def create_journal_entry(
    db: AsyncSession, company_id: uuid.UUID, data: JournalEntryCreate
) -> JournalEntry:
    """Crée une écriture brouillon (draft) équilibrée avec >= 2 lignes.

    Valide l'équilibre (helper pur), vérifie que tous les comptes sont du tenant,
    génère la référence JE-YYYY-NNNNN et recopie company_id sur chaque ligne.
    """
    validate_balanced(data.lines)

    if not await _accounts_belong_to_company(
        db, company_id, (line.account_id for line in data.lines)
    ):
        raise AccountingError("account_not_found")

    year = data.entry_date.year
    sequence = await _next_entry_sequence(db, company_id, year)
    reference = format_reference(year, sequence)

    entry = JournalEntry(
        company_id=company_id,
        reference=reference,
        entry_date=data.entry_date,
        description=data.description,
        status="draft",
    )
    for line in data.lines:
        entry.lines.append(
            JournalLine(
                company_id=company_id,  # dénormalisé depuis l'écriture, jamais le client
                account_id=line.account_id,
                debit=Decimal(line.debit),
                credit=Decimal(line.credit),
                description=line.description,
            )
        )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_journal_entry(
    db: AsyncSession, company_id: uuid.UUID, entry_id: uuid.UUID
) -> JournalEntry | None:
    """Récupère une écriture (lignes chargées via selectin) du tenant courant."""
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.company_id == company_id,
            JournalEntry.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_journal_entries(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[JournalEntry], int]:
    """Liste paginée des écritures du tenant."""
    base = select(JournalEntry).where(
        JournalEntry.company_id == company_id,
        JournalEntry.deleted_at.is_(None),
    )
    if status:
        base = base.where(JournalEntry.status == status)
    if date_from is not None:
        base = base.where(JournalEntry.entry_date >= date_from)
    if date_to is not None:
        base = base.where(JournalEntry.entry_date <= date_to)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def post_journal_entry(
    db: AsyncSession, company_id: uuid.UUID, entry_id: uuid.UUID
) -> JournalEntry | None:
    """Transition draft -> posted (idempotence-gardée), repose posted_at.

    Revalide l'équilibre (un brouillon a pu être édité). Retourne None si l'écriture
    est introuvable dans le tenant. Lève AccountingError si l'état n'est pas 'draft'
    ou si les lignes ne sont plus équilibrées.
    """
    entry = await get_journal_entry(db, company_id, entry_id)
    if entry is None:
        return None
    if entry.status != "draft":
        raise AccountingError("entry_not_draft")

    lines_in = [
        JournalLineIn(
            account_id=line.account_id,
            debit=line.debit,
            credit=line.credit,
            description=line.description,
        )
        for line in entry.lines
    ]
    validate_balanced(lines_in)

    entry.status = "posted"
    entry.posted_at = datetime.now(UTC)
    entry.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(entry)
    return entry


async def void_journal_entry(
    db: AsyncSession, company_id: uuid.UUID, entry_id: uuid.UUID
) -> JournalEntry | None:
    """Transition draft|posted -> void. Seule voie de contre-passation (pas de DELETE)."""
    entry = await get_journal_entry(db, company_id, entry_id)
    if entry is None:
        return None
    if entry.status not in ("draft", "posted"):
        raise AccountingError("entry_not_voidable")
    entry.status = "void"
    entry.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(entry)
    return entry


# ── Balance générale (trial balance) ────────────────────────────────────────


async def trial_balance(db: AsyncSession, company_id: uuid.UUID) -> TrialBalance:
    """Balance par compte sur les écritures POSTÉES uniquement.

    Agrège sum(débit)/sum(crédit) des lignes non supprimées rattachées à des
    écritures `posted` non supprimées, regroupées par compte. Le total des débits
    DOIT égaler le total des crédits (invariant de la partie double).
    """
    stmt = (
        select(
            ChartAccount.id,
            ChartAccount.code,
            ChartAccount.name_en,
            ChartAccount.type,
            func.coalesce(func.sum(JournalLine.debit), 0),
            func.coalesce(func.sum(JournalLine.credit), 0),
        )
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .join(ChartAccount, JournalLine.account_id == ChartAccount.id)
        .where(
            JournalLine.company_id == company_id,
            JournalLine.deleted_at.is_(None),
            JournalEntry.company_id == company_id,
            JournalEntry.deleted_at.is_(None),
            JournalEntry.status == "posted",
        )
        .group_by(ChartAccount.id, ChartAccount.code, ChartAccount.name_en, ChartAccount.type)
        .order_by(ChartAccount.code)
    )
    rows = (await db.execute(stmt)).all()

    out_rows: list[TrialBalanceRow] = []
    total_debit = _ZERO
    total_credit = _ZERO
    for account_id, code, name_en, acct_type, debit_sum, credit_sum in rows:
        debit = Decimal(str(debit_sum))
        credit = Decimal(str(credit_sum))
        total_debit += debit
        total_credit += credit
        out_rows.append(
            TrialBalanceRow(
                account_id=account_id,
                code=code,
                name_en=name_en,
                type=acct_type,
                total_debit=debit,
                total_credit=credit,
                balance=debit - credit,
            )
        )

    return TrialBalance(rows=out_rows, total_debit=total_debit, total_credit=total_credit)


# ── Export CSV du grand-livre (une ligne par ligne d'écriture) ───────────────

ENTRIES_CSV_COLUMNS = (
    "reference",
    "entry_date",
    "status",
    "account_code",
    "account_name",
    "debit",
    "credit",
    "description",
)


async def entries_csv(
    db: AsyncSession,
    company_id: uuid.UUID,
    status: str | None = None,
) -> str:
    """Export CSV du grand-livre : une ligne par ligne d'écriture (jointure
    ligne → écriture → compte), tenant-scopé (Loi 1), ordre antéchrono.

    `status` filtre optionnellement les écritures (draft/posted/void)."""
    query = (
        select(JournalEntry, JournalLine, ChartAccount)
        .join(JournalLine, JournalLine.entry_id == JournalEntry.id)
        .join(ChartAccount, ChartAccount.id == JournalLine.account_id)
        .where(
            JournalEntry.company_id == company_id,
            JournalEntry.deleted_at.is_(None),
            JournalLine.deleted_at.is_(None),
        )
    )
    if status:
        query = query.where(JournalEntry.status == status)
    query = query.order_by(JournalEntry.entry_date.desc(), JournalEntry.reference.desc())
    rows = (await db.execute(query)).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(ENTRIES_CSV_COLUMNS)
    for entry, line, account in rows:
        writer.writerow(
            [
                entry.reference,
                entry.entry_date.isoformat() if entry.entry_date else "",
                entry.status,
                account.code,
                account.name_en,
                f"{line.debit:.2f}",
                f"{line.credit:.2f}",
                line.description or "",
            ]
        )
    return buf.getvalue()
