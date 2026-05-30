"""Service — Reporting. Agrégations en lecture seule, toujours filtrées par
company_id (Loi 1). Aucune écriture : ce module ne fait que lire les tables
métier (finance, locatif, maintenance, catalogue) pour produire des KPIs.
"""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.finance import FinanceTransaction
from app.models.golden_visa import GoldenVisaApplication
from app.models.maintenance import MaintenanceTicket
from app.models.property import Property
from app.models.rental import Rental
from app.routers.reporting.schemas import (
    FinancialReport,
    MaintenanceReport,
    OverviewReport,
    RentalReport,
)

# Statuts maintenance considérés comme « clos » (hors du décompte « ouverts »).
_MAINTENANCE_CLOSED = ("resolved", "closed", "cancelled")
# Statuts Golden Visa terminaux (hors « en cours »).
_GV_TERMINAL = ("approved", "rejected", "expired")


async def _scalar(db: AsyncSession, stmt) -> Decimal:
    """Exécute un SELECT scalaire et renvoie un Decimal (0 si NULL)."""
    return Decimal(str((await db.execute(stmt)).scalar_one()))


def _count_stmt(model, company_id: uuid.UUID, *extra):
    """Construit un SELECT count(*) filtré tenant + soft-delete (+ conditions extra)."""
    return select(func.count()).select_from(
        select(model)
        .where(model.company_id == company_id, model.deleted_at.is_(None), *extra)
        .subquery()
    )


async def _count(db: AsyncSession, model, company_id: uuid.UUID, *extra) -> int:
    return (await db.execute(_count_stmt(model, company_id, *extra))).scalar_one()


async def _paid_sum(db: AsyncSession, company_id: uuid.UUID, direction: str) -> Decimal:
    return await _scalar(
        db,
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.direction == direction,
            FinanceTransaction.status == "paid",
        ),
    )


async def overview(db: AsyncSession, company_id: uuid.UUID) -> OverviewReport:
    """KPIs transversaux du tenant (compteurs + résultat financier net)."""
    properties_total = await _count(db, Property, company_id)
    clients_total = await _count(db, Client, company_id)
    active_rentals = await _count(db, Rental, company_id, Rental.status == "active")
    open_maintenance = await _count(
        db,
        MaintenanceTicket,
        company_id,
        MaintenanceTicket.status.notin_(_MAINTENANCE_CLOSED),
    )
    golden_visa_pending = await _count(
        db,
        GoldenVisaApplication,
        company_id,
        GoldenVisaApplication.status.notin_(_GV_TERMINAL),
    )

    revenue = await _paid_sum(db, company_id, "credit")
    expenses = await _paid_sum(db, company_id, "debit")

    return OverviewReport(
        properties_total=properties_total,
        clients_total=clients_total,
        active_rentals=active_rentals,
        open_maintenance=open_maintenance,
        golden_visa_pending=golden_visa_pending,
        net_revenue=revenue - expenses,
    )


async def financial_report(db: AsyncSession, company_id: uuid.UUID) -> FinancialReport:
    """Revenus / dépenses encaissés + ventilation des montants payés par type."""
    revenue = await _paid_sum(db, company_id, "credit")
    expenses = await _paid_sum(db, company_id, "debit")
    pending_amount = await _scalar(
        db,
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.status == "pending",
        ),
    )

    rows = (
        await db.execute(
            select(
                FinanceTransaction.type,
                func.coalesce(func.sum(FinanceTransaction.amount), 0),
            )
            .where(
                FinanceTransaction.company_id == company_id,
                FinanceTransaction.deleted_at.is_(None),
                FinanceTransaction.status == "paid",
            )
            .group_by(FinanceTransaction.type)
        )
    ).all()
    paid_by_type = {t: Decimal(str(amount)) for t, amount in rows}

    return FinancialReport(
        total_revenue=revenue,
        total_expenses=expenses,
        net=revenue - expenses,
        pending_amount=pending_amount,
        paid_by_type=paid_by_type,
    )


async def rental_report(
    db: AsyncSession, company_id: uuid.UUID, expiring_days: int = 120
) -> RentalReport:
    """État du portefeuille locatif : actifs, loyer mensuel cumulé, expirations."""
    from datetime import date, timedelta

    rows = (
        await db.execute(
            select(Rental.status, func.count())
            .where(Rental.company_id == company_id, Rental.deleted_at.is_(None))
            .group_by(Rental.status)
        )
    ).all()
    by_status = {s: n for s, n in rows}

    monthly_rent_roll = await _scalar(
        db,
        select(func.coalesce(func.sum(Rental.monthly_rent), 0)).where(
            Rental.company_id == company_id,
            Rental.deleted_at.is_(None),
            Rental.status == "active",
        ),
    )

    today = date.today()
    cutoff = today + timedelta(days=expiring_days)
    expiring_soon = await _count(
        db,
        Rental,
        company_id,
        Rental.status == "active",
        Rental.end_date >= today,
        Rental.end_date <= cutoff,
    )

    return RentalReport(
        active_count=by_status.get("active", 0),
        by_status=by_status,
        monthly_rent_roll=monthly_rent_roll,
        expiring_soon=expiring_soon,
    )


async def maintenance_report(db: AsyncSession, company_id: uuid.UUID) -> MaintenanceReport:
    """Tickets de maintenance par statut / priorité + nombre d'ouverts."""
    status_rows = (
        await db.execute(
            select(MaintenanceTicket.status, func.count())
            .where(
                MaintenanceTicket.company_id == company_id,
                MaintenanceTicket.deleted_at.is_(None),
            )
            .group_by(MaintenanceTicket.status)
        )
    ).all()
    by_status = {s: n for s, n in status_rows}

    priority_rows = (
        await db.execute(
            select(MaintenanceTicket.priority, func.count())
            .where(
                MaintenanceTicket.company_id == company_id,
                MaintenanceTicket.deleted_at.is_(None),
            )
            .group_by(MaintenanceTicket.priority)
        )
    ).all()
    by_priority = {p: n for p, n in priority_rows}

    open_count = sum(n for s, n in by_status.items() if s not in _MAINTENANCE_CLOSED)

    return MaintenanceReport(
        by_status=by_status,
        by_priority=by_priority,
        open_count=open_count,
    )
