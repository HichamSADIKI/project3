"""Service — Clôture de période comptable (finance). Filtre company_id (Loi 1).

Une clôture enregistre une `period_end` ; toute transaction dont la date
(`created_at`) est <= la dernière `period_end` clôturée est verrouillée
(modification interdite)."""

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.period_closure import PeriodClosure


class PeriodClosedError(ValueError):
    """La transaction appartient à une période clôturée (verrouillée)."""

    def __init__(self) -> None:
        super().__init__("period_closed")
        self.code = "period_closed"


class ClosureError(ValueError):
    """Erreur métier clôture (code lisible)."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


async def close_period(
    db: AsyncSession,
    company_id: uuid.UUID,
    period_end: date,
    note: str | None = None,
    closed_by: str | None = None,
) -> PeriodClosure:
    """Clôture une période jusqu'à `period_end`. Rejette un doublon de période."""
    exists = (
        await db.execute(
            select(func.count(PeriodClosure.id)).where(
                PeriodClosure.company_id == company_id,
                PeriodClosure.period_end == period_end,
                PeriodClosure.deleted_at.is_(None),
            )
        )
    ).scalar_one()
    if exists:
        raise ClosureError("period_already_closed")
    closure = PeriodClosure(
        company_id=company_id, period_end=period_end, note=note, closed_by=closed_by
    )
    db.add(closure)
    await db.commit()
    await db.refresh(closure)
    return closure


async def list_closures(db: AsyncSession, company_id: uuid.UUID) -> list[PeriodClosure]:
    """Liste les clôtures du tenant, de la plus récente à la plus ancienne."""
    rows = (
        (
            await db.execute(
                select(PeriodClosure)
                .where(PeriodClosure.company_id == company_id, PeriodClosure.deleted_at.is_(None))
                .order_by(PeriodClosure.period_end.desc())
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


async def latest_closed_period_end(db: AsyncSession, company_id: uuid.UUID) -> date | None:
    """Dernière date de clôture du tenant (None si aucune)."""
    return (
        await db.execute(
            select(func.max(PeriodClosure.period_end)).where(
                PeriodClosure.company_id == company_id,
                PeriodClosure.deleted_at.is_(None),
            )
        )
    ).scalar_one()


async def is_date_closed(db: AsyncSession, company_id: uuid.UUID, d: date) -> bool:
    """Vrai si la date `d` tombe dans une période clôturée (d <= dernière clôture)."""
    latest = await latest_closed_period_end(db, company_id)
    return latest is not None and d <= latest
