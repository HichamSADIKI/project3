"""Service — Finance. Toujours filtrer par company_id (Loi 1)."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinanceTransaction
from app.routers.finance.schemas import (
    FinanceSummary,
    TransactionCreate,
    TransactionUpdate,
)


async def _next_transaction_sequence(db: AsyncSession, year: int) -> int:
    """Calcule le prochain numéro de séquence pour les références de transaction."""
    prefix = f"TXN-{year}-"
    result = await db.execute(
        select(func.count(FinanceTransaction.id)).where(
            FinanceTransaction.reference.like(f"{prefix}%")
        )
    )
    count: int = result.scalar_one()
    return count + 1


async def list_transactions(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    type_: str | None = None,
    status: str | None = None,
    direction: str | None = None,
) -> tuple[list[FinanceTransaction], int]:
    """Retourne la liste paginée des transactions du tenant."""
    base_query = select(FinanceTransaction).where(
        FinanceTransaction.company_id == company_id,
        FinanceTransaction.deleted_at.is_(None),
    )

    if type_:
        base_query = base_query.where(FinanceTransaction.type == type_)
    if status:
        base_query = base_query.where(FinanceTransaction.status == status)
    if direction:
        base_query = base_query.where(FinanceTransaction.direction == direction)

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total: int = total_result.scalar_one()

    offset = (page - 1) * limit
    paginated_query = (
        base_query.order_by(FinanceTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(paginated_query)
    transactions = list(result.scalars().all())

    return transactions, total


async def get_transaction(
    db: AsyncSession,
    company_id: uuid.UUID,
    txn_id: uuid.UUID,
) -> FinanceTransaction | None:
    """Récupère une transaction par son ID dans le tenant courant."""
    result = await db.execute(
        select(FinanceTransaction).where(
            FinanceTransaction.id == txn_id,
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_transaction(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: TransactionCreate,
) -> FinanceTransaction:
    """Crée une transaction financière avec référence auto-générée."""
    now = datetime.now(timezone.utc)
    year = now.year
    seq = await _next_transaction_sequence(db, year)
    reference = f"TXN-{year}-{seq:05d}"

    txn = FinanceTransaction(
        company_id=company_id,
        reference=reference,
        type=data.type,
        direction=data.direction,
        amount=data.amount,
        currency=data.currency,
        status="pending",
        description_en=data.description_en,
        description_ar=data.description_ar,
        description_fr=data.description_fr,
        related_contract_id=data.related_contract_id,
        related_client_id=data.related_client_id,
        related_property_id=data.related_property_id,
        due_date=data.due_date,
        payment_method=data.payment_method,
        bank_reference=data.bank_reference,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


async def update_transaction(
    db: AsyncSession,
    company_id: uuid.UUID,
    txn_id: uuid.UUID,
    data: TransactionUpdate,
) -> FinanceTransaction | None:
    """
    Met à jour une transaction.
    - status → "paid" sans paid_at fourni : positionne paid_at = now()
    """
    txn = await get_transaction(db, company_id, txn_id)
    if not txn:
        return None

    update_data = data.model_dump(exclude_unset=True)

    now = datetime.now(timezone.utc)
    if update_data.get("status") == "paid" and not update_data.get("paid_at"):
        update_data["paid_at"] = now

    for field, value in update_data.items():
        setattr(txn, field, value)

    txn.updated_at = now
    await db.commit()
    await db.refresh(txn)
    return txn


async def get_summary(
    db: AsyncSession,
    company_id: uuid.UUID,
) -> FinanceSummary:
    """
    Calcule les KPIs financiers du tenant via des agrégations SQL.
    - Revenus : transactions credit + paid
    - Dépenses : transactions debit + paid
    - Factures en attente
    - Montant payé ce mois
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Revenus totaux (credit, paid)
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.direction == "credit",
            FinanceTransaction.status == "paid",
        )
    )
    total_revenue = Decimal(str(revenue_result.scalar_one()))

    # Dépenses totales (debit, paid)
    expenses_result = await db.execute(
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.direction == "debit",
            FinanceTransaction.status == "paid",
        )
    )
    total_expenses = Decimal(str(expenses_result.scalar_one()))

    # Factures en attente (type=invoice, status=pending)
    pending_count_result = await db.execute(
        select(func.count(FinanceTransaction.id)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.type == "invoice",
            FinanceTransaction.status == "pending",
        )
    )
    pending_invoices: int = pending_count_result.scalar_one()

    pending_amount_result = await db.execute(
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.type == "invoice",
            FinanceTransaction.status == "pending",
        )
    )
    pending_amount = Decimal(str(pending_amount_result.scalar_one()))

    # Montant payé ce mois
    paid_month_result = await db.execute(
        select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.company_id == company_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.status == "paid",
            FinanceTransaction.paid_at >= month_start,
        )
    )
    paid_this_month = Decimal(str(paid_month_result.scalar_one()))

    return FinanceSummary(
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        net=total_revenue - total_expenses,
        pending_invoices=pending_invoices,
        pending_amount=pending_amount,
        paid_this_month=paid_this_month,
    )
