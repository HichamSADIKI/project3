"""Router FastAPI — Finance."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.finance.closure import (
    ClosureError,
    PeriodClosedError,
    close_period,
    list_closures,
)
from app.routers.finance.invoice import InvoiceError, generate_and_store_invoice
from app.routers.finance.schemas import (
    AgedReceivables,
    CashFlowForecast,
    FinanceSummary,
    InvoicePdfOut,
    PeriodClosureCreate,
    PeriodClosureListOut,
    PeriodClosureOut,
    PnlReport,
    TransactionCreate,
    TransactionDetailOut,
    TransactionListOut,
    TransactionOut,
    TransactionUpdate,
    VatReport,
)
from app.routers.finance.service import (
    cash_flow_forecast,
    create_transaction,
    get_aged_receivables,
    get_pnl,
    get_summary,
    get_transaction,
    get_vat_report,
    list_transactions,
    transactions_csv,
    update_transaction,
)

router = APIRouter(prefix="/finance", tags=["finance"])


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    """Récupère le company_id depuis la session PostgreSQL (injecté par le middleware JWT)."""
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_context_missing",
        )
    return uuid.UUID(raw)


def _require_roles(*allowed_roles: str):
    """Dépendance FastAPI vérifiant le rôle de l'utilisateur."""

    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient_permissions",
            )

    return _check


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "finance", "status": "ok"}


@router.get("/summary", response_model=FinanceSummary)
async def get_finance_summary(
    db: AsyncSession = Depends(get_db_session),
) -> FinanceSummary:
    """Retourne les KPIs financiers agrégés du tenant."""
    company_id = await _get_company_id(db)
    return await get_summary(db, company_id)


@router.get("/reports/pnl", response_model=PnlReport)
async def get_pnl_report(
    period: str = Query("month", pattern="^(month|quarter|ytd)$"),
    db: AsyncSession = Depends(get_db_session),
) -> PnlReport:
    """Compte de résultat (P&L) du tenant sur la période (mois/trimestre/année)."""
    company_id = await _get_company_id(db)
    return await get_pnl(db, company_id, period)  # type: ignore[arg-type]


@router.get("/reports/aged-receivables", response_model=AgedReceivables)
async def get_aged_receivables_report(
    db: AsyncSession = Depends(get_db_session),
) -> AgedReceivables:
    """Balance âgée des factures impayées du tenant (tranches de retard)."""
    company_id = await _get_company_id(db)
    return await get_aged_receivables(db, company_id)


@router.get("/reports/vat", response_model=VatReport)
async def get_vat_report_endpoint(
    period: str = Query("quarter", pattern="^(month|quarter|ytd)$"),
    db: AsyncSession = Depends(get_db_session),
) -> VatReport:
    """Rapport TVA (UAE 5 %) du tenant sur la période (déclaration trimestrielle)."""
    company_id = await _get_company_id(db)
    return await get_vat_report(db, company_id, period)  # type: ignore[arg-type]


@router.get("/reports/cashflow", response_model=CashFlowForecast)
async def get_cashflow_forecast(
    db: AsyncSession = Depends(get_db_session),
) -> CashFlowForecast:
    """Prévision de trésorerie du tenant (flux attendus par tranche d'échéance)."""
    company_id = await _get_company_id(db)
    return await cash_flow_forecast(db, company_id)


@router.get("/period-closures", response_model=PeriodClosureListOut)
async def list_period_closures(
    db: AsyncSession = Depends(get_db_session),
) -> PeriodClosureListOut:
    """Liste les clôtures de période du tenant."""
    company_id = await _get_company_id(db)
    closures = await list_closures(db, company_id)
    return PeriodClosureListOut(data=[PeriodClosureOut.model_validate(c) for c in closures])


@router.post(
    "/period-closures",
    response_model=PeriodClosureOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager", "accounting"))],
)
async def create_period_closure(
    body: PeriodClosureCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> PeriodClosureOut:
    """Clôture une période (verrouille les transactions <= period_end)."""
    company_id = await _get_company_id(db)
    closed_by = getattr(request.state, "user_email", None) or getattr(request.state, "role", None)
    try:
        closure = await close_period(db, company_id, body.period_end, body.note, closed_by)
    except ClosureError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.code) from err
    return PeriodClosureOut.model_validate(closure)


@router.get("/transactions", response_model=TransactionListOut)
async def list_transactions_endpoint(
    type_filter: str | None = Query(
        None,
        alias="type",
        pattern="^(invoice|payment|expense|commission|refund)$",
    ),
    status_filter: str | None = Query(
        None,
        alias="status",
        pattern="^(pending|paid|cancelled|overdue)$",
    ),
    direction: str | None = Query(None, pattern="^(debit|credit)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> TransactionListOut:
    company_id = await _get_company_id(db)
    transactions, total = await list_transactions(
        db, company_id, page, limit, type_filter, status_filter, direction
    )
    return TransactionListOut(
        data=[TransactionOut.model_validate(t) for t in transactions],
        meta={"total": total, "page": page, "limit": limit},
    )


# Déclaré AVANT /transactions/{txn_id} pour que « export » ne soit pas pris pour un id.
@router.get("/transactions/export")
async def export_transactions_csv(
    type_filter: str | None = Query(
        None, alias="type", pattern="^(invoice|payment|expense|commission|refund)$"
    ),
    status_filter: str | None = Query(
        None, alias="status", pattern="^(pending|paid|cancelled|overdue)$"
    ),
    direction: str | None = Query(None, pattern="^(debit|credit)$"),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export CSV des transactions du tenant (téléchargement)."""
    company_id = await _get_company_id(db)
    csv_text = await transactions_csv(db, company_id, type_filter, status_filter, direction)
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="transactions.csv"'},
    )


@router.post(
    "/transactions",
    response_model=TransactionDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager", "accounting"))],
)
async def create_transaction_endpoint(
    body: TransactionCreate,
    db: AsyncSession = Depends(get_db_session),
) -> TransactionDetailOut:
    company_id = await _get_company_id(db)
    txn = await create_transaction(db, company_id, body)
    return TransactionDetailOut(data=TransactionOut.model_validate(txn))


@router.get("/transactions/{txn_id}", response_model=TransactionDetailOut)
async def get_transaction_endpoint(
    txn_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> TransactionDetailOut:
    company_id = await _get_company_id(db)
    txn = await get_transaction(db, company_id, txn_id)
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="transaction_not_found")
    return TransactionDetailOut(data=TransactionOut.model_validate(txn))


@router.patch(
    "/transactions/{txn_id}",
    response_model=TransactionDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager", "accounting"))],
)
async def update_transaction_endpoint(
    txn_id: uuid.UUID,
    body: TransactionUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> TransactionDetailOut:
    company_id = await _get_company_id(db)
    try:
        txn = await update_transaction(db, company_id, txn_id, body)
    except PeriodClosedError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err.code) from err
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="transaction_not_found")
    return TransactionDetailOut(data=TransactionOut.model_validate(txn))


@router.post(
    "/transactions/{txn_id}/invoice",
    response_model=InvoicePdfOut,
    dependencies=[Depends(_require_roles("admin", "manager", "accounting"))],
)
async def generate_invoice_endpoint(
    txn_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> InvoicePdfOut:
    """Génère la facture PDF d'une transaction (type=invoice) et renvoie son URL."""
    company_id = await _get_company_id(db)
    try:
        url = await generate_and_store_invoice(db, company_id, txn_id)
    except InvoiceError as err:
        code = (
            status.HTTP_404_NOT_FOUND
            if err.code == "transaction_not_found"
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=err.code) from err
    return InvoicePdfOut(data={"url": url})
