"""Service — Contracts. Toujours filtrer par company_id (Loi 1).

Inclut le renouvellement (M5) et le câblage e-signature via le module
documents (M2) : le contrat référence un `signing_document_id` ; quand toutes
les signatures de ce document sont posées, le contrat passe `signed`.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.property import Property
from app.models.rental import Rental
from app.routers.contracts.schemas import (
    ContractCreate,
    ContractRenew,
    ContractUpdate,
)
from app.routers.documents.service import all_signatures_complete, list_signatures
from app.routers.rentals.service import _add_months, _build_payment_schedule


# ─── Helpers métier purs (renouvellement) ──────────────────────────────────


def is_renewable(status: str) -> bool:
    """Un contrat est renouvelable s'il est actif ou expiré (pas draft/cancelled)."""
    return status in {"active", "expired"}


def compute_renewal_dates(
    old_start: date | None, old_end: date | None, term_months: int | None = None
) -> tuple[date | None, date | None]:
    """Dates du contrat renouvelé.

    Nouveau début = lendemain de l'ancienne fin. Durée = `term_months` si fourni,
    sinon on reconduit la durée de l'ancien contrat (en mois ~ jours/30).
    """
    if old_end is None:
        return None, None
    new_start = old_end + timedelta(days=1)
    if term_months is not None:
        return new_start, _add_months(new_start, term_months)
    if old_start is not None:
        months = max(1, round((old_end - old_start).days / 30))
        return new_start, _add_months(new_start, months)
    return new_start, _add_months(new_start, 12)


def apply_rent_escalation(amount: Decimal, pct: Decimal) -> Decimal:
    """Applique une escalade de loyer en pourcentage, arrondie à 2 décimales."""
    escalated = amount * (Decimal("1") + pct / Decimal("100"))
    return escalated.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def _next_contract_sequence(db: AsyncSession, year: int) -> int:
    """Calcule le prochain numéro de séquence pour les références de contrat."""
    prefix = f"CNT-{year}-"
    result = await db.execute(
        select(func.count(Contract.id)).where(
            Contract.reference.like(f"{prefix}%")
        )
    )
    count: int = result.scalar_one()
    return count + 1


async def list_contracts(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    type_: str | None = None,
    status: str | None = None,
    client_id: uuid.UUID | None = None,
) -> tuple[list[Contract], int]:
    """Retourne la liste paginée des contrats du tenant."""
    base_query = select(Contract).where(
        Contract.company_id == company_id,
        Contract.deleted_at.is_(None),
    )

    if type_:
        base_query = base_query.where(Contract.type == type_)
    if status:
        base_query = base_query.where(Contract.status == status)
    if client_id:
        base_query = base_query.where(Contract.client_id == client_id)

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total: int = total_result.scalar_one()

    offset = (page - 1) * limit
    paginated_query = (
        base_query.order_by(Contract.created_at.desc()).offset(offset).limit(limit)
    )
    result = await db.execute(paginated_query)
    contracts = list(result.scalars().all())

    return contracts, total


async def get_contract(
    db: AsyncSession,
    company_id: uuid.UUID,
    contract_id: uuid.UUID,
) -> Contract | None:
    """Récupère un contrat par son ID dans le tenant courant."""
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.company_id == company_id,
            Contract.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_contract(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: ContractCreate,
) -> Contract:
    """Crée un contrat avec référence auto-générée et commission calculée."""
    now = datetime.now(timezone.utc)
    year = now.year
    seq = await _next_contract_sequence(db, year)
    reference = f"CNT-{year}-{seq:04d}"

    commission_amount = Decimal(str(data.amount)) * Decimal(str(data.commission_rate)) / Decimal("100")

    contract = Contract(
        company_id=company_id,
        reference=reference,
        type=data.type,
        client_id=data.client_id,
        property_id=data.property_id,
        agent_id=data.agent_id,
        amount=data.amount,
        commission_rate=data.commission_rate,
        commission_amount=commission_amount,
        status="draft",
        start_date=data.start_date,
        end_date=data.end_date,
        notes_en=data.notes_en,
        notes_ar=data.notes_ar,
        notes_fr=data.notes_fr,
        documents=[],
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return contract


async def update_contract(
    db: AsyncSession,
    company_id: uuid.UUID,
    contract_id: uuid.UUID,
    data: ContractUpdate,
) -> Contract | None:
    """
    Met à jour un contrat.
    - status → "signed" : positionne signed_at
    - status → "active" : met à jour le statut de la propriété (sold / rented)
    """
    contract = await get_contract(db, company_id, contract_id)
    if not contract:
        return None

    update_data = data.model_dump(exclude_unset=True)
    new_status = update_data.get("status")

    # Recalcule commission si amount ou commission_rate changent
    new_amount = update_data.get("amount", contract.amount)
    new_rate = update_data.get("commission_rate", contract.commission_rate)
    if "amount" in update_data or "commission_rate" in update_data:
        update_data["commission_amount"] = (
            Decimal(str(new_amount)) * Decimal(str(new_rate)) / Decimal("100")
        )

    for field, value in update_data.items():
        setattr(contract, field, value)

    now = datetime.now(timezone.utc)

    if new_status == "signed" and not contract.signed_at:
        contract.signed_at = now

    if new_status == "active":
        prop_result = await db.execute(
            select(Property).where(
                Property.id == contract.property_id,
                Property.deleted_at.is_(None),
            )
        )
        prop = prop_result.scalar_one_or_none()
        if prop:
            prop.status = "sold" if contract.type == "sale" else "rented"
            prop.updated_at = now

    contract.updated_at = now
    await db.commit()
    await db.refresh(contract)
    return contract


async def delete_contract(
    db: AsyncSession,
    company_id: uuid.UUID,
    contract_id: uuid.UUID,
) -> bool:
    """
    Soft-delete d'un contrat, uniquement si son statut est "draft".
    Ne supprime jamais physiquement.
    """
    contract = await get_contract(db, company_id, contract_id)
    if not contract:
        return False
    if contract.status != "draft":
        raise ValueError("only_draft_contracts_can_be_deleted")

    contract.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True


# ─── Renouvellement (M5) ────────────────────────────────────────────────────


async def _rental_for_contract(
    db: AsyncSession, company_id: uuid.UUID, contract_id: uuid.UUID
) -> Rental | None:
    result = await db.execute(
        select(Rental).where(
            Rental.contract_id == contract_id,
            Rental.company_id == company_id,
            Rental.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def renew_contract(
    db: AsyncSession,
    company_id: uuid.UUID,
    contract_id: uuid.UUID,
    data: ContractRenew,
) -> Contract | None | str:
    """Crée un contrat renouvelé (draft) lié au parent. Si type rental, crée aussi
    le nouveau bail. Retourne le nouveau contrat, None si introuvable, ou
    'not_renewable' si l'état ne permet pas le renouvellement."""
    old = await get_contract(db, company_id, contract_id)
    if old is None:
        return None
    if not is_renewable(old.status):
        return "not_renewable"

    new_start, new_end = compute_renewal_dates(
        old.start_date, old.end_date, data.term_months
    )
    new_amount = apply_rent_escalation(
        Decimal(str(old.amount)), Decimal(str(data.rent_escalation_pct))
    )

    now = datetime.now(timezone.utc)
    seq = await _next_contract_sequence(db, now.year)
    reference = f"CNT-{now.year}-{seq:04d}"
    commission_amount = (
        new_amount * Decimal(str(old.commission_rate)) / Decimal("100")
    )

    new_contract = Contract(
        company_id=company_id,
        reference=reference,
        type=old.type,
        client_id=old.client_id,
        property_id=old.property_id,
        agent_id=old.agent_id,
        amount=new_amount,
        commission_rate=old.commission_rate,
        commission_amount=commission_amount,
        status="draft",
        start_date=new_start,
        end_date=new_end,
        notes_en=old.notes_en,
        notes_ar=old.notes_ar,
        notes_fr=old.notes_fr,
        documents=[],
        renewed_from_contract_id=old.id,
    )
    db.add(new_contract)
    await db.flush()

    # Renouvellement du bail si contrat de location.
    if old.type == "rental":
        old_rental = await _rental_for_contract(db, company_id, old.id)
        if old_rental is not None and new_start is not None and new_end is not None:
            new_monthly = apply_rent_escalation(
                Decimal(str(old_rental.monthly_rent)),
                Decimal(str(data.rent_escalation_pct)),
            )
            new_rental = Rental(
                company_id=company_id,
                contract_id=new_contract.id,
                client_id=old_rental.client_id,
                property_id=old_rental.property_id,
                monthly_rent=new_monthly,
                annual_rent=new_monthly * 12,
                deposit=old_rental.deposit,
                payment_frequency=old_rental.payment_frequency,
                status="active",
                start_date=new_start,
                end_date=new_end,
                renewal_alert_sent=False,
                payment_schedule=_build_payment_schedule(
                    new_start, new_end, new_monthly, old_rental.payment_frequency
                ),
                renewed_from_rental_id=old_rental.id,
            )
            db.add(new_rental)

    await db.commit()
    await db.refresh(new_contract)
    return new_contract


# ─── E-signature via module documents (M5/M2) ───────────────────────────────


async def link_signing_document(
    db: AsyncSession,
    company_id: uuid.UUID,
    contract_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Contract | None:
    contract = await get_contract(db, company_id, contract_id)
    if contract is None:
        return None
    contract.signing_document_id = document_id
    contract.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(contract)
    return contract


async def sync_contract_signature(
    db: AsyncSession, company_id: uuid.UUID, contract_id: uuid.UUID
) -> Contract | None | str:
    """Synchronise le statut du contrat avec les signatures de son document M2.
    Quand toutes les signatures sont posées → contract.status='signed'."""
    contract = await get_contract(db, company_id, contract_id)
    if contract is None:
        return None
    if contract.signing_document_id is None:
        return "no_signing_document"
    sigs = await list_signatures(db, company_id, contract.signing_document_id)
    if all_signatures_complete([s.status for s in sigs]):
        now = datetime.now(timezone.utc)
        if contract.status not in {"active", "expired", "cancelled"}:
            contract.status = "signed"
        if contract.signed_at is None:
            contract.signed_at = now
        contract.updated_at = now
        await db.commit()
        await db.refresh(contract)
    return contract
