"""Router FastAPI — Finance."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.routers.finance.schemas import (
    FinanceSummary,
    TransactionCreate,
    TransactionDetailOut,
    TransactionListOut,
    TransactionOut,
    TransactionUpdate,
)
from app.routers.finance.service import (
    create_transaction,
    get_summary,
    get_transaction,
    list_transactions,
    update_transaction,
)

router = APIRouter(prefix="/finance", tags=["finance"])


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    """Récupère le company_id depuis la session PostgreSQL (injecté par le middleware JWT)."""
    result = await db.execute(
        sql_text("SELECT current_setting('app.current_company_id', true)")
    )
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
    db: AsyncSession = Depends(get_db),
) -> FinanceSummary:
    """Retourne les KPIs financiers agrégés du tenant."""
    company_id = await _get_company_id(db)
    return await get_summary(db, company_id)


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
    db: AsyncSession = Depends(get_db),
) -> TransactionListOut:
    company_id = await _get_company_id(db)
    transactions, total = await list_transactions(
        db, company_id, page, limit, type_filter, status_filter, direction
    )
    return TransactionListOut(
        data=[TransactionOut.model_validate(t) for t in transactions],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/transactions",
    response_model=TransactionDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager", "accounting"))],
)
async def create_transaction_endpoint(
    body: TransactionCreate,
    db: AsyncSession = Depends(get_db),
) -> TransactionDetailOut:
    company_id = await _get_company_id(db)
    txn = await create_transaction(db, company_id, body)
    return TransactionDetailOut(data=TransactionOut.model_validate(txn))


@router.get("/transactions/{txn_id}", response_model=TransactionDetailOut)
async def get_transaction_endpoint(
    txn_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> TransactionDetailOut:
    company_id = await _get_company_id(db)
    txn = await get_transaction(db, company_id, txn_id)
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="transaction_not_found"
        )
    return TransactionDetailOut(data=TransactionOut.model_validate(txn))


@router.patch(
    "/transactions/{txn_id}",
    response_model=TransactionDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager", "accounting"))],
)
async def update_transaction_endpoint(
    txn_id: uuid.UUID,
    body: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
) -> TransactionDetailOut:
    company_id = await _get_company_id(db)
    txn = await update_transaction(db, company_id, txn_id, body)
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="transaction_not_found"
        )
    return TransactionDetailOut(data=TransactionOut.model_validate(txn))
