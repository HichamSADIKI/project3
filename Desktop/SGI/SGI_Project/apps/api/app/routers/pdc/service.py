"""Service — PDC (post-dated cheques).

Cycle de vie strict :
  pending → deposited → cleared
                      → bounced → replaced (terminal pour ce cheque)
  pending → cancelled (annulation avant dépôt)
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.contract import Contract
from app.models.pdc_cheque import PdcCheque
from app.models.rental import Rental
from app.routers.pdc.schemas import PdcCreate, PdcUpdate


# ─── Logique métier pure ──────────────────────────────────────────────────


_VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"deposited", "cancelled"},
    "deposited": {"cleared", "bounced"},
    "cleared": set(),
    "bounced": {"replaced"},
    "replaced": set(),
    "cancelled": set(),
}


def is_valid_pdc_transition(current: str, target: str) -> bool:
    return target in _VALID_TRANSITIONS.get(current, set())


def days_to_due(today: date, due: date) -> int:
    return (due - today).days


def is_overdue(today: date, due: date, status: str) -> bool:
    """Un PDC est en retard de dépôt si due_date < today et status == 'pending'."""
    return status == "pending" and due < today


def generate_reference(year: int, sequence: int) -> str:
    """Format interne : PDC-YYYY-NNNNNN (6 chiffres pour faciliter le tri)."""
    return f"PDC-{year}-{sequence:06d}"


def aggregate_outstanding(cheques: list[PdcCheque]) -> Decimal:
    """Somme des montants des PDC encore actifs (pending ou deposited)."""
    return sum(
        (Decimal(str(c.amount_aed)) for c in cheques if c.status in ("pending", "deposited")),
        Decimal("0.00"),
    )


# ─── CRUD ─────────────────────────────────────────────────────────────────


async def _next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    """Génère une référence unique par tenant + année courante."""
    year = datetime.now(timezone.utc).year
    count_result = await db.execute(
        select(func.count(PdcCheque.id)).where(
            PdcCheque.company_id == company_id,
            func.extract("year", PdcCheque.created_at) == year,
        )
    )
    seq = int(count_result.scalar_one() or 0) + 1
    return generate_reference(year, seq)


async def list_pdc(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    rental_id: uuid.UUID | None = None,
    contract_id: uuid.UUID | None = None,
    drawer_party_id: uuid.UUID | None = None,
) -> tuple[list[PdcCheque], int]:
    base = select(PdcCheque).where(
        PdcCheque.company_id == company_id,
        PdcCheque.deleted_at.is_(None),
    )
    if status:
        base = base.where(PdcCheque.status == status)
    if rental_id:
        base = base.where(PdcCheque.rental_id == rental_id)
    if contract_id:
        base = base.where(PdcCheque.contract_id == contract_id)
    if drawer_party_id:
        base = base.where(PdcCheque.drawer_party_id == drawer_party_id)

    total: int = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    offset = (page - 1) * limit
    paginated = base.order_by(PdcCheque.due_date).offset(offset).limit(limit)
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_pdc(
    db: AsyncSession, company_id: uuid.UUID, pdc_id: uuid.UUID
) -> PdcCheque | None:
    result = await db.execute(
        select(PdcCheque).where(
            PdcCheque.id == pdc_id,
            PdcCheque.company_id == company_id,
            PdcCheque.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _validate_links(
    db: AsyncSession, company_id: uuid.UUID, data: PdcCreate
) -> bool:
    """Vérifie l'existence des liens (rental/contract/drawer) dans le même tenant."""
    if data.rental_id:
        rental_check = await db.execute(
            select(Rental.id).where(
                Rental.id == data.rental_id,
                Rental.company_id == company_id,
                Rental.deleted_at.is_(None),
            )
        )
        if rental_check.scalar_one_or_none() is None:
            return False
    if data.contract_id:
        contract_check = await db.execute(
            select(Contract.id).where(
                Contract.id == data.contract_id,
                Contract.company_id == company_id,
                Contract.deleted_at.is_(None),
            )
        )
        if contract_check.scalar_one_or_none() is None:
            return False

    drawer_check = await db.execute(
        select(Client.id).where(
            Client.id == data.drawer_party_id,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    if drawer_check.scalar_one_or_none() is None:
        return False
    return True


async def create_pdc(
    db: AsyncSession, company_id: uuid.UUID, data: PdcCreate
) -> PdcCheque | None:
    if not await _validate_links(db, company_id, data):
        return None

    reference = await _next_reference(db, company_id)
    pdc = PdcCheque(
        company_id=company_id,
        reference=reference,
        rental_id=data.rental_id,
        contract_id=data.contract_id,
        drawer_party_id=data.drawer_party_id,
        cheque_number=data.cheque_number,
        bank_name=data.bank_name,
        bank_branch=data.bank_branch,
        account_holder_name=data.account_holder_name,
        amount_aed=data.amount_aed,
        due_date=data.due_date,
        document_path=data.document_path,
        ocr_data=data.ocr_data,
        ocr_confidence=data.ocr_confidence,
        notes=data.notes,
    )
    db.add(pdc)
    await db.commit()
    await db.refresh(pdc)
    return pdc


async def update_pdc(
    db: AsyncSession,
    company_id: uuid.UUID,
    pdc_id: uuid.UUID,
    data: PdcUpdate,
) -> PdcCheque | None:
    pdc = await get_pdc(db, company_id, pdc_id)
    if pdc is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pdc, field, value)
    pdc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pdc)
    return pdc


# ─── Actions de cycle de vie ──────────────────────────────────────────────


async def mark_deposited(
    db: AsyncSession,
    company_id: uuid.UUID,
    pdc_id: uuid.UUID,
    deposit_date: date,
) -> PdcCheque | None | str:
    pdc = await get_pdc(db, company_id, pdc_id)
    if pdc is None:
        return None
    if not is_valid_pdc_transition(pdc.status, "deposited"):
        return "invalid_transition"
    pdc.status = "deposited"
    pdc.deposit_date = deposit_date
    pdc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pdc)
    return pdc


async def mark_cleared(
    db: AsyncSession, company_id: uuid.UUID, pdc_id: uuid.UUID
) -> PdcCheque | None | str:
    pdc = await get_pdc(db, company_id, pdc_id)
    if pdc is None:
        return None
    if not is_valid_pdc_transition(pdc.status, "cleared"):
        return "invalid_transition"
    now = datetime.now(timezone.utc)
    pdc.status = "cleared"
    pdc.cleared_at = now
    pdc.updated_at = now
    await db.commit()
    await db.refresh(pdc)
    return pdc


async def mark_bounced(
    db: AsyncSession,
    company_id: uuid.UUID,
    pdc_id: uuid.UUID,
    bounce_reason: str,
    bounce_fee_aed: Decimal = Decimal("0"),
) -> PdcCheque | None | str:
    pdc = await get_pdc(db, company_id, pdc_id)
    if pdc is None:
        return None
    if not is_valid_pdc_transition(pdc.status, "bounced"):
        return "invalid_transition"
    now = datetime.now(timezone.utc)
    pdc.status = "bounced"
    pdc.bounced_at = now
    pdc.bounce_reason = bounce_reason
    pdc.bounce_fee_aed = bounce_fee_aed
    pdc.updated_at = now
    await db.commit()
    await db.refresh(pdc)
    return pdc


async def mark_cancelled(
    db: AsyncSession, company_id: uuid.UUID, pdc_id: uuid.UUID
) -> PdcCheque | None | str:
    pdc = await get_pdc(db, company_id, pdc_id)
    if pdc is None:
        return None
    if not is_valid_pdc_transition(pdc.status, "cancelled"):
        return "invalid_transition"
    pdc.status = "cancelled"
    pdc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pdc)
    return pdc


async def replace_bounced(
    db: AsyncSession,
    company_id: uuid.UUID,
    pdc_id: uuid.UUID,
    new_cheque: PdcCreate,
) -> tuple[PdcCheque, PdcCheque] | None | str:
    """
    Remplace un PDC `bounced` par un nouveau. Crée le nouveau PDC, le lie à
    l'ancien via replaced_by_pdc_id, et passe l'ancien en `replaced`.
    Retour : (ancien, nouveau) ou code d'erreur.
    """
    old = await get_pdc(db, company_id, pdc_id)
    if old is None:
        return None
    if not is_valid_pdc_transition(old.status, "replaced"):
        return "invalid_transition"

    new = await create_pdc(db, company_id, new_cheque)
    if new is None:
        return None

    now = datetime.now(timezone.utc)
    old.status = "replaced"
    old.replaced_by_pdc_id = new.id
    old.updated_at = now
    await db.commit()
    await db.refresh(old)
    return old, new


async def increment_legal_notices(
    db: AsyncSession, company_id: uuid.UUID, pdc_id: uuid.UUID
) -> PdcCheque | None:
    pdc = await get_pdc(db, company_id, pdc_id)
    if pdc is None:
        return None
    pdc.legal_notices_sent += 1
    pdc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pdc)
    return pdc


async def soft_delete_pdc(
    db: AsyncSession, company_id: uuid.UUID, pdc_id: uuid.UUID
) -> bool:
    pdc = await get_pdc(db, company_id, pdc_id)
    if pdc is None:
        return False
    pdc.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True


# ─── Calendrier de dépôt ──────────────────────────────────────────────────


async def deposit_calendar(
    db: AsyncSession,
    company_id: uuid.UUID,
    today: date,
    horizon_days: int = 60,
) -> list[dict]:
    """
    Renvoie les PDC actifs (pending ou deposited) avec due_date dans la
    fenêtre [today - 30j, today + horizon_days]. Trié par due_date.
    """
    from datetime import timedelta

    window_start = today - timedelta(days=30)
    window_end = today + timedelta(days=horizon_days)

    result = await db.execute(
        select(PdcCheque)
        .where(
            PdcCheque.company_id == company_id,
            PdcCheque.deleted_at.is_(None),
            PdcCheque.status.in_(("pending", "deposited")),
            PdcCheque.due_date >= window_start,
            PdcCheque.due_date <= window_end,
        )
        .order_by(PdcCheque.due_date)
    )
    rows = list(result.scalars().all())
    return [
        {
            "pdc_id": p.id,
            "reference": p.reference,
            "cheque_number": p.cheque_number,
            "amount_aed": p.amount_aed,
            "due_date": p.due_date,
            "status": p.status,
            "days_to_due": days_to_due(today, p.due_date),
        }
        for p in rows
    ]
