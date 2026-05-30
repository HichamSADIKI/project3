"""Service — Owners. Toujours filtrer par company_id (Loi 1)."""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.party_owner import Owner
from app.routers.owners.schemas import OwnerCreate, OwnerUpdate

# ─── Helpers métier purs (testables sans DB) ──────────────────────────────


def mandate_is_active(
    today: date,
    start: date | None,
    end: date | None,
) -> bool:
    """
    Un mandat est actif si :
    - start_date <= today (ou start_date None)
    - ET end_date >= today (ou end_date None = mandat à durée indéterminée)
    """
    if start is not None and today < start:
        return False
    if end is not None and today > end:
        return False
    return start is not None or end is not None  # au moins une borne définie


def days_until_mandate_expiry(today: date, end: date | None) -> int | None:
    """Nombre de jours restants avant expiration du mandat. None si pas d'échéance."""
    if end is None:
        return None
    return (end - today).days


def needs_renewal_alert(today: date, end: date | None, threshold_days: int = 60) -> bool:
    """Vrai si le mandat expire dans <= threshold_days et n'est pas encore expiré."""
    remaining = days_until_mandate_expiry(today, end)
    if remaining is None:
        return False
    return 0 <= remaining <= threshold_days


# ─── CRUD ─────────────────────────────────────────────────────────────────


async def list_owners(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    residency_uae: bool | None = None,
) -> tuple[list[Owner], int]:
    base_query = select(Owner).where(
        Owner.company_id == company_id,
        Owner.deleted_at.is_(None),
    )
    if residency_uae is not None:
        base_query = base_query.where(Owner.residency_uae == residency_uae)

    count_query = select(func.count()).select_from(base_query.subquery())
    total: int = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * limit
    paginated = base_query.order_by(Owner.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_owner(db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID) -> Owner | None:
    result = await db.execute(
        select(Owner).where(
            Owner.party_id == party_id,
            Owner.company_id == company_id,
            Owner.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_owner(db: AsyncSession, company_id: uuid.UUID, data: OwnerCreate) -> Owner | None:
    """
    Crée le profil owner pour un client existant.
    Retourne None si le client n'existe pas ou si un profil owner existe déjà.
    """
    # Vérifier que le client existe dans le même tenant
    client_check = await db.execute(
        select(Client.id).where(
            Client.id == data.party_id,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    if client_check.scalar_one_or_none() is None:
        return None

    # Vérifier qu'il n'existe pas déjà un profil owner pour ce client
    existing = await get_owner(db, company_id, data.party_id)
    if existing is not None:
        return None

    owner = Owner(
        party_id=data.party_id,
        company_id=company_id,
        residency_uae=data.residency_uae,
        emirates_id=data.emirates_id,
        emirates_id_expiry=data.emirates_id_expiry,
        passport_number=data.passport_number,
        passport_expiry=data.passport_expiry,
        mandate_reference=data.mandate_reference,
        mandate_signed_at=data.mandate_signed_at,
        mandate_start_date=data.mandate_start_date,
        mandate_end_date=data.mandate_end_date,
        mandate_commission_rate=data.mandate_commission_rate,
        mandate_document_path=data.mandate_document_path,
        bank_iban=data.bank_iban,
        bank_swift=data.bank_swift,
        bank_name=data.bank_name,
        preferred_payout_method=data.preferred_payout_method,
        monthly_statement_enabled=data.monthly_statement_enabled,
        expense_approval_threshold_aed=data.expense_approval_threshold_aed,
    )
    db.add(owner)
    await db.commit()
    await db.refresh(owner)
    return owner


async def update_owner(
    db: AsyncSession,
    company_id: uuid.UUID,
    party_id: uuid.UUID,
    data: OwnerUpdate,
) -> Owner | None:
    owner = await get_owner(db, company_id, party_id)
    if owner is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(owner, field, value)
    owner.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(owner)
    return owner


async def delete_owner(db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID) -> bool:
    owner = await get_owner(db, company_id, party_id)
    if owner is None:
        return False
    owner.deleted_at = datetime.now(UTC)
    await db.commit()
    return True
