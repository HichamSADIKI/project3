"""Schémas Pydantic v2 — Reporting (KPIs en lecture seule, montants en AED)."""

from decimal import Decimal

from pydantic import BaseModel


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
