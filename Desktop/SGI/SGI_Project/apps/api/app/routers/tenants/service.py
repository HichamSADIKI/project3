"""Service — Tenants. Cycle de vie + loyalty score."""
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.party_tenant import TenantProfile
from app.routers.tenants.schemas import TenantCreate, TenantUpdate


# ─── Logique métier pure ──────────────────────────────────────────────────


# Transitions valides du cycle de vie
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "candidate": {"active", "former", "blacklisted"},
    "active": {"former", "blacklisted"},
    "former": {"active", "blacklisted"},  # ré-activation possible
    "blacklisted": set(),  # terminal
}


def is_valid_transition(current: str, target: str) -> bool:
    """Vérifie qu'une transition lifecycle est autorisée."""
    return target in _VALID_TRANSITIONS.get(current, set())


def valid_next_statuses(current: str) -> set[str]:
    return _VALID_TRANSITIONS.get(current, set())


def compute_loyalty_score(
    on_time_payments: int,
    late_payments: int,
    missed_payments: int,
    incidents: int,
    years_active: float,
) -> int:
    """
    Score de loyauté 0-100 calculé à partir de l'historique.

    Base 50 + bonus/malus :
      + 2 par paiement à temps
      - 5 par paiement en retard
      - 15 par paiement manqué
      - 10 par incident locataire
      + 5 par année d'ancienneté (plafonné à +25)
    """
    score = 50
    score += 2 * on_time_payments
    score -= 5 * late_payments
    score -= 15 * missed_payments
    score -= 10 * incidents
    score += min(25, int(5 * years_active))
    return max(0, min(100, score))


def visa_alert_level(today: date, expiry: date | None) -> str | None:
    """
    Niveau d'alerte d'expiration visa :
      'expired'  → expiration dépassée
      'critical' → expire dans <= 30 jours
      'warning'  → expire dans <= 90 jours
      None       → pas d'alerte
    """
    if expiry is None:
        return None
    remaining = (expiry - today).days
    if remaining < 0:
        return "expired"
    if remaining <= 30:
        return "critical"
    if remaining <= 90:
        return "warning"
    return None


# ─── CRUD ─────────────────────────────────────────────────────────────────


async def list_tenants(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    lifecycle_status: str | None = None,
) -> tuple[list[TenantProfile], int]:
    base_query = select(TenantProfile).where(
        TenantProfile.company_id == company_id,
        TenantProfile.deleted_at.is_(None),
    )
    if lifecycle_status:
        base_query = base_query.where(
            TenantProfile.lifecycle_status == lifecycle_status
        )

    total: int = (
        await db.execute(select(func.count()).select_from(base_query.subquery()))
    ).scalar_one()

    offset = (page - 1) * limit
    paginated = (
        base_query.order_by(TenantProfile.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_tenant(
    db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID
) -> TenantProfile | None:
    result = await db.execute(
        select(TenantProfile).where(
            TenantProfile.party_id == party_id,
            TenantProfile.company_id == company_id,
            TenantProfile.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_tenant(
    db: AsyncSession, company_id: uuid.UUID, data: TenantCreate
) -> TenantProfile | None:
    client_check = await db.execute(
        select(Client.id).where(
            Client.id == data.party_id,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    if client_check.scalar_one_or_none() is None:
        return None

    if await get_tenant(db, company_id, data.party_id) is not None:
        return None

    now = datetime.now(timezone.utc)
    tenant = TenantProfile(
        party_id=data.party_id,
        company_id=company_id,
        lifecycle_status=data.lifecycle_status,
        emirates_id=data.emirates_id,
        emirates_id_expiry=data.emirates_id_expiry,
        passport_number=data.passport_number,
        passport_expiry=data.passport_expiry,
        visa_number=data.visa_number,
        visa_expiry=data.visa_expiry,
        visa_type=data.visa_type,
        monthly_income_aed=data.monthly_income_aed,
        employer_name=data.employer_name,
        employer_phone=data.employer_phone,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone,
        emergency_contact_relation=data.emergency_contact_relation,
        loyalty_score=data.loyalty_score,
        candidacy_submitted_at=now if data.lifecycle_status == "candidate" else None,
    )
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    return tenant


async def update_tenant(
    db: AsyncSession,
    company_id: uuid.UUID,
    party_id: uuid.UUID,
    data: TenantUpdate,
) -> TenantProfile | None:
    tenant = await get_tenant(db, company_id, party_id)
    if tenant is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)
    tenant.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(tenant)
    return tenant


async def change_lifecycle_status(
    db: AsyncSession,
    company_id: uuid.UUID,
    party_id: uuid.UUID,
    target: str,
    reason: str | None = None,
) -> TenantProfile | None | str:
    """
    Transition d'état explicite.
    Retourne :
      - TenantProfile mis à jour si OK
      - None si tenant introuvable
      - 'invalid_transition' (str) si transition non autorisée
    """
    tenant = await get_tenant(db, company_id, party_id)
    if tenant is None:
        return None

    if not is_valid_transition(tenant.lifecycle_status, target):
        return "invalid_transition"

    now = datetime.now(timezone.utc)
    if target == "active":
        tenant.activated_at = now
        tenant.candidacy_approved_at = tenant.candidacy_approved_at or now
    elif target == "blacklisted":
        tenant.blacklisted_at = now
        tenant.blacklist_reason = reason

    tenant.lifecycle_status = target
    tenant.updated_at = now
    await db.commit()
    await db.refresh(tenant)
    return tenant


async def delete_tenant(
    db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID
) -> bool:
    tenant = await get_tenant(db, company_id, party_id)
    if tenant is None:
        return False
    tenant.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True
