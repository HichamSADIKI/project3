"""Service Paiements — CRUD demandes + transactions + résumés. Filtre company_id."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import PaymentRequest, PaymentTransaction

from .schemas import PayIn, RequestCreate


# ── Helpers purs ──────────────────────────────────────────────────────────

def generate_reference(year: int, sequence: int) -> str:
    return f"PAY-{year}-{sequence:06d}"


def is_overdue(due: date, status: str, today: date) -> bool:
    """Une demande est en retard si pending et due_date < today."""
    return status == "pending" and due < today


async def _next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    year = datetime.now(timezone.utc).year
    count = (await db.execute(
        select(func.count(PaymentRequest.id)).where(
            PaymentRequest.company_id == company_id,
            func.extract("year", PaymentRequest.created_at) == year,
        )
    )).scalar_one() or 0
    return generate_reference(year, count + 1)


# ── Demandes ──────────────────────────────────────────────────────────────

async def create_request(
    db: AsyncSession, company_id: uuid.UUID, data: RequestCreate
) -> PaymentRequest:
    ref = await _next_reference(db, company_id)
    req = PaymentRequest(
        company_id=company_id,
        reference=ref,
        tenant_client_id=data.tenant_client_id,
        owner_client_id=data.owner_client_id,
        unit_id=data.unit_id,
        rental_id=data.rental_id,
        payment_type=data.payment_type,
        status="pending",
        amount_aed=data.amount_aed,
        due_date=data.due_date,
        description=data.description,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def get_request(
    db: AsyncSession, company_id: uuid.UUID, request_id: uuid.UUID
) -> PaymentRequest | None:
    result = await db.execute(
        select(PaymentRequest).where(
            PaymentRequest.id == request_id,
            PaymentRequest.company_id == company_id,
            PaymentRequest.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_requests(
    db: AsyncSession,
    company_id: uuid.UUID,
    status: str | None = None,
    payment_type: str | None = None,
    unit_id: uuid.UUID | None = None,
    tenant_client_id: uuid.UUID | None = None,
    owner_client_id: uuid.UUID | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[PaymentRequest], int]:
    filters = [
        PaymentRequest.company_id == company_id,
        PaymentRequest.deleted_at.is_(None),
    ]
    if status:
        filters.append(PaymentRequest.status == status)
    if payment_type:
        filters.append(PaymentRequest.payment_type == payment_type)
    if unit_id:
        filters.append(PaymentRequest.unit_id == unit_id)
    if tenant_client_id:
        filters.append(PaymentRequest.tenant_client_id == tenant_client_id)
    if owner_client_id:
        filters.append(PaymentRequest.owner_client_id == owner_client_id)

    total = (await db.execute(
        select(func.count()).select_from(PaymentRequest).where(and_(*filters))
    )).scalar_one()

    result = await db.execute(
        select(PaymentRequest).where(and_(*filters))
        .order_by(PaymentRequest.due_date.desc())
        .offset((page - 1) * limit).limit(limit)
    )
    return list(result.scalars().all()), total


async def pay_request(
    db: AsyncSession, company_id: uuid.UUID, request_id: uuid.UUID, data: PayIn
) -> PaymentRequest | None:
    """Marque une demande comme payée + crée la transaction (simulation UAE)."""
    req = await get_request(db, company_id, request_id)
    if not req:
        return None
    if req.status not in ("pending", "overdue"):
        raise HTTPException(status_code=422, detail="request_not_payable")

    now = datetime.now(timezone.utc)
    req.status = "paid"
    req.paid_at = now

    tx = PaymentTransaction(
        company_id=company_id,
        request_id=req.id,
        status="settled",
        method=data.method,
        amount_aed=req.amount_aed,
        external_ref=data.external_ref,
        settled_at=now,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(req)
    return req


# ── Résumés ───────────────────────────────────────────────────────────────

async def owner_summary(
    db: AsyncSession, company_id: uuid.UUID, owner_client_id: uuid.UUID
) -> dict:
    """Agrégats financiers d'un propriétaire (montants reçus / en attente / retard)."""
    rows = (await db.execute(
        select(PaymentRequest.status, PaymentRequest.amount_aed).where(
            PaymentRequest.company_id == company_id,
            PaymentRequest.owner_client_id == owner_client_id,
            PaymentRequest.deleted_at.is_(None),
        )
    )).all()

    received = Decimal("0")
    pending = Decimal("0")
    overdue = Decimal("0")
    for status_val, amount in rows:
        amt = Decimal(str(amount))
        if status_val == "paid":
            received += amt
        elif status_val == "overdue":
            overdue += amt
        elif status_val == "pending":
            pending += amt

    return {
        "total_received_aed": received,
        "pending_aed": pending,
        "overdue_aed": overdue,
        "requests_count": len(rows),
    }
