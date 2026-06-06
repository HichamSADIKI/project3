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
from app.routers.crm.service import get_pipeline_kpis
from app.routers.finance.schemas import AgedReceivables, FinanceSummary
from app.routers.finance.service import (
    cash_flow_forecast,
    get_aged_receivables,
    get_summary,
)
from app.routers.leasing.service import leasing_pipeline_summary
from app.routers.rentals.service import rent_roll_summary
from app.routers.reporting.schemas import (
    ExecutiveDashboardOut,
    ExecutiveHeadline,
    FinancialReport,
    MaintenanceReport,
    OverviewReport,
    RentalReport,
)
from app.routers.sales.service import sales_pipeline_summary
from app.routers.units.service import occupancy_summary

# Statuts maintenance considérés comme « clos » (hors du décompte « ouverts »).
_MAINTENANCE_CLOSED = ("resolved", "closed", "cancelled")
# Statuts Golden Visa terminaux (hors « en cours »).
_GV_TERMINAL = ("approved", "rejected", "expired")
# Statuts CRM terminaux — exclus du décompte « prospects actifs ».
_CRM_TERMINAL = ("won", "lost")


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


# ── Tableau de bord exécutif (BI transversal) ──────────────────────────────


def _dec(value: object) -> Decimal:
    """Convertit une valeur d'agrégat (Decimal/str/float/None) en Decimal sûr."""
    if value is None:
        return Decimal(0)
    return value if isinstance(value, Decimal) else Decimal(str(value))


def compute_headline(
    *,
    finance: FinanceSummary,
    receivables: AgedReceivables,
    rentals: dict[str, object],
    units: dict[str, object],
    crm: dict[str, int],
    sales: dict[str, object],
) -> ExecutiveHeadline:
    """Chiffres-clés de la bannière — pur (sans DB), donc unitaire-testable.

    `active_leads` = somme des prospects CRM hors statuts terminaux (won/lost).
    """
    active_leads = sum(n for s, n in crm.items() if s not in _CRM_TERMINAL)
    offers = sales.get("offers", {}) if isinstance(sales.get("offers"), dict) else {}
    txns = sales.get("transactions", {}) if isinstance(sales.get("transactions"), dict) else {}
    return ExecutiveHeadline(
        net_paid=finance.net,
        pending_amount=finance.pending_amount,
        overdue_total=receivables.total,
        overdue_count=receivables.count,
        monthly_rent_roll=_dec(rentals.get("monthly_rent_aed")),
        occupancy_rate_pct=int(units.get("occupancy_rate_pct") or 0),  # type: ignore[arg-type]
        active_leads=active_leads,
        sales_completed_value=_dec(txns.get("completed_value_aed")),
        open_offers_amount=_dec(offers.get("open_amount_aed")),
    )


async def executive_dashboard(db: AsyncSession, company_id: uuid.UUID) -> ExecutiveDashboardOut:
    """Instantané consolidé multi-modules (lecture seule). Chaque service filtre
    déjà par company_id (Loi 1) ; on ne fait qu'orchestrer + dériver la bannière."""
    ov = await overview(db, company_id)
    finance = await get_summary(db, company_id)
    cashflow = await cash_flow_forecast(db, company_id)
    receivables = await get_aged_receivables(db, company_id)
    sales = await sales_pipeline_summary(db, company_id)
    leasing = await leasing_pipeline_summary(db, company_id)
    rentals = await rent_roll_summary(db, company_id)
    crm = await get_pipeline_kpis(db, str(company_id))
    units = await occupancy_summary(db, company_id)
    headline = compute_headline(
        finance=finance,
        receivables=receivables,
        rentals=rentals,
        units=units,
        crm=crm,
        sales=sales,
    )
    return ExecutiveDashboardOut(
        headline=headline,
        overview=ov,
        finance=finance,
        cashflow=cashflow,
        receivables=receivables,
        sales=sales,
        leasing=leasing,
        rentals=rentals,
        crm=crm,
        units=units,
    )
