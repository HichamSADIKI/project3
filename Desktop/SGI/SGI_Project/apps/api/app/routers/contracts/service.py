"""Service — Contracts. Toujours filtrer par company_id (Loi 1)."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.property import Property
from app.routers.contracts.schemas import ContractCreate, ContractUpdate


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
