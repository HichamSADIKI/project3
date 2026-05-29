"""Service — Vendors. Marketplace + rating cumulé."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.party_vendor import Vendor
from app.routers.vendors.schemas import VendorCreate, VendorUpdate

# ─── Logique métier pure ──────────────────────────────────────────────────


def merge_rating(
    current_avg: Decimal, current_count: int, new_score: Decimal
) -> tuple[Decimal, int]:
    """
    Met à jour la moyenne cumulée d'évaluation après une nouvelle note.
    Formule incrémentale stable numériquement :
      new_avg = ((current_avg * current_count) + new_score) / (current_count + 1)
    """
    new_count = current_count + 1
    total = (current_avg * current_count) + new_score
    new_avg = (total / new_count).quantize(Decimal("0.01"))
    return new_avg, new_count


def cancellation_rate(jobs_completed: int, jobs_cancelled: int) -> Decimal:
    """% de missions annulées. 0 si aucune mission."""
    total = jobs_completed + jobs_cancelled
    if total == 0:
        return Decimal("0.00")
    return (Decimal(jobs_cancelled) * 100 / total).quantize(Decimal("0.01"))


def is_eligible_for_marketplace(
    is_active: bool,
    rating_avg: Decimal,
    rating_count: int,
    trade_licence_expiry: date | None,
    today: date,
    verification_status: str = "verified",
) -> bool:
    """
    Éligibilité au marketplace prestataires.
    Critères :
      - profil validé par un admin (verification_status = 'verified')
      - is_active = True
      - licence commerciale valide (non expirée)
      - note ≥ 3.5 OU pas encore de note (nouveau prestataire)

    `verification_status` est optionnel (défaut 'verified') pour rester
    rétro-compatible avec les fiches créées avant le workflow d'onboarding.
    """
    if verification_status != "verified":
        return False
    if not is_active:
        return False
    if trade_licence_expiry is not None and trade_licence_expiry < today:
        return False
    if rating_count == 0:
        return True
    return rating_avg >= Decimal("3.5")


# ─── CRUD ─────────────────────────────────────────────────────────────────


async def list_vendors(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    vendor_type: str | None = None,
    is_active: bool | None = None,
) -> tuple[list[Vendor], int]:
    base_query = select(Vendor).where(
        Vendor.company_id == company_id,
        Vendor.deleted_at.is_(None),
    )
    if vendor_type:
        base_query = base_query.where(Vendor.vendor_type == vendor_type)
    if is_active is not None:
        base_query = base_query.where(Vendor.is_active == is_active)

    total: int = (
        await db.execute(select(func.count()).select_from(base_query.subquery()))
    ).scalar_one()

    offset = (page - 1) * limit
    paginated = (
        base_query.order_by(Vendor.rating_avg.desc(), Vendor.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_vendor(
    db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID
) -> Vendor | None:
    result = await db.execute(
        select(Vendor).where(
            Vendor.party_id == party_id,
            Vendor.company_id == company_id,
            Vendor.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_vendor(
    db: AsyncSession, company_id: uuid.UUID, data: VendorCreate
) -> Vendor | None:
    client_check = await db.execute(
        select(Client.id).where(
            Client.id == data.party_id,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    if client_check.scalar_one_or_none() is None:
        return None

    if await get_vendor(db, company_id, data.party_id) is not None:
        return None

    # Au moins une catégorie activée (la principale par défaut), dédupliquée.
    categories = list(dict.fromkeys(data.categories or [data.vendor_type]))
    if data.vendor_type not in categories:
        categories.insert(0, data.vendor_type)

    vendor = Vendor(
        party_id=data.party_id,
        company_id=company_id,
        vendor_type=data.vendor_type,
        categories=categories,
        specialities=data.specialities,
        service_areas=data.service_areas,
        trade_licence_number=data.trade_licence_number,
        trade_licence_expiry=data.trade_licence_expiry,
        trade_licence_authority=data.trade_licence_authority,
        insurance_policy_number=data.insurance_policy_number,
        insurance_expiry=data.insurance_expiry,
        preferred_payment_terms=data.preferred_payment_terms,
        emergency_24_7=data.emergency_24_7,
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return vendor


async def update_vendor(
    db: AsyncSession,
    company_id: uuid.UUID,
    party_id: uuid.UUID,
    data: VendorUpdate,
) -> Vendor | None:
    vendor = await get_vendor(db, company_id, party_id)
    if vendor is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vendor, field, value)
    vendor.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(vendor)
    return vendor


async def add_rating(
    db: AsyncSession,
    company_id: uuid.UUID,
    party_id: uuid.UUID,
    score: Decimal,
) -> Vendor | None:
    vendor = await get_vendor(db, company_id, party_id)
    if vendor is None:
        return None
    new_avg, new_count = merge_rating(vendor.rating_avg, vendor.rating_count, score)
    vendor.rating_avg = new_avg
    vendor.rating_count = new_count
    vendor.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(vendor)
    return vendor


async def delete_vendor(
    db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID
) -> bool:
    vendor = await get_vendor(db, company_id, party_id)
    if vendor is None:
        return False
    vendor.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True
