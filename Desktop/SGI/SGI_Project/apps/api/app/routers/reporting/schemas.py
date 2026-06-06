"""Schémas Pydantic v2 — Reporting (KPIs en lecture seule, montants en AED)."""

from decimal import Decimal
from typing import Any

from pydantic import BaseModel

from app.routers.finance.schemas import AgedReceivables, CashFlowForecast, FinanceSummary


class OverviewReport(BaseModel):
    """Tableau de bord transversal du tenant."""

    properties_total: int
    clients_total: int
    active_rentals: int
    open_maintenance: int
    golden_visa_pending: int
    net_revenue: Decimal  # revenus encaissés − dépenses payées (AED)


class FinancialReport(BaseModel):
    total_revenue: Decimal
    total_expenses: Decimal
    net: Decimal
    pending_amount: Decimal
    paid_by_type: dict[str, Decimal]  # type de transaction → montant payé cumulé


class RentalReport(BaseModel):
    active_count: int
    by_status: dict[str, int]
    monthly_rent_roll: Decimal  # loyer mensuel cumulé des baux actifs (AED)
    expiring_soon: int  # baux actifs expirant dans la fenêtre demandée


class MaintenanceReport(BaseModel):
    by_status: dict[str, int]
    by_priority: dict[str, int]
    open_count: int  # tickets non clos (hors resolved/closed/cancelled)


# ── Tableau de bord exécutif (BI transversal) ──────────────────────────────


class ExecutiveHeadline(BaseModel):
    """Chiffres-clés de la bannière (calculés purement à partir des agrégats)."""

    net_paid: Decimal  # résultat encaissé (revenus payés − dépenses payées)
    pending_amount: Decimal  # factures en attente
    overdue_total: Decimal  # créances échues impayées
    overdue_count: int
    monthly_rent_roll: Decimal  # loyer mensuel récurrent (baux actifs)
    occupancy_rate_pct: int
    active_leads: int  # prospects CRM non terminaux
    sales_completed_value: Decimal  # valeur des transactions de vente clôturées
    open_offers_amount: Decimal  # offres soumises en cours


class ExecutiveDashboardOut(BaseModel):
    """Instantané consolidé multi-modules pour la direction (lecture seule)."""

    success: bool = True
    headline: ExecutiveHeadline
    overview: OverviewReport
    finance: FinanceSummary
    cashflow: CashFlowForecast
    receivables: AgedReceivables
    sales: dict[str, Any]
    leasing: dict[str, Any]
    rentals: dict[str, Any]
    crm: dict[str, int]
    units: dict[str, Any]
