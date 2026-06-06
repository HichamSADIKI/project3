"""Router FastAPI — Reporting (lecture seule, agrégations par tenant)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.reporting.schemas import (
    ExecutiveDashboardOut,
    FinancialReport,
    MaintenanceReport,
    OverviewReport,
    RentalReport,
)
from app.routers.reporting.service import (
    executive_dashboard,
    financial_report,
    maintenance_report,
    overview,
    rental_report,
)

router = APIRouter(prefix="/reporting", tags=["reporting"])

# Rapports réservés au staff (les rôles publics client/fournisseur n'y accèdent pas).
_STAFF_ROLES = ("admin", "manager", "agent", "accounting")


def _get_company_id(request: Request) -> uuid.UUID:
    """company_id depuis l'état de requête (posé par TenantMiddleware via le JWT).
    Aligné sur owner_portal/client_portal — robuste vis-à-vis du pool de connexions."""
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_context_missing",
        )
    return uuid.UUID(raw)


def _require_staff():
    async def _check(request: Request) -> None:
        if getattr(request.state, "role", None) not in _STAFF_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient_permissions",
            )

    return _check


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "reporting", "status": "ok"}


@router.get(
    "/executive",
    response_model=ExecutiveDashboardOut,
    dependencies=[Depends(_require_staff())],
)
async def get_executive(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> ExecutiveDashboardOut:
    """Tableau de bord exécutif : instantané KPI consolidé multi-modules."""
    return await executive_dashboard(db, _get_company_id(request))


@router.get(
    "/overview",
    response_model=OverviewReport,
    dependencies=[Depends(_require_staff())],
)
async def get_overview(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> OverviewReport:
    return await overview(db, _get_company_id(request))


@router.get(
    "/financial",
    response_model=FinancialReport,
    dependencies=[Depends(_require_staff())],
)
async def get_financial(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> FinancialReport:
    return await financial_report(db, _get_company_id(request))


@router.get(
    "/rentals",
    response_model=RentalReport,
    dependencies=[Depends(_require_staff())],
)
async def get_rentals(
    request: Request,
    expiring_days: int = Query(120, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
) -> RentalReport:
    return await rental_report(db, _get_company_id(request), expiring_days)


@router.get(
    "/maintenance",
    response_model=MaintenanceReport,
    dependencies=[Depends(_require_staff())],
)
async def get_maintenance(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> MaintenanceReport:
    return await maintenance_report(db, _get_company_id(request))
