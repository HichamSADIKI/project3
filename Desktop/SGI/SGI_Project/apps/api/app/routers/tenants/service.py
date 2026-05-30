"""Service — Tenants. Cycle de vie + loyalty score + KYC."""
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.document import Document
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


# ─── KYC — vérification d'identité (M4) ────────────────────────────────────


# Documents requis pour valider le KYC (types du module documents M2).
KYC_REQUIRED_DOC_TYPES: frozenset[str] = frozenset({"id", "passport"})

# Machine à états KYC.
_KYC_TRANSITIONS: dict[str, set[str]] = {
    "not_started": {"pending"},
    "pending": {"verified", "rejected"},
    "verified": set(),  # terminal
    "rejected": {"pending"},  # nouvelle soumission après correction
}


def is_valid_kyc_transition(current: str, target: str) -> bool:
    """Vérifie une transition du workflow KYC."""
    return target in _KYC_TRANSITIONS.get(current, set())


def kyc_required_doc_types() -> frozenset[str]:
    return KYC_REQUIRED_DOC_TYPES


def kyc_missing_documents(present_doc_types: set[str]) -> list[str]:
    """Types de documents requis encore manquants (triés, déterministe)."""
    return sorted(KYC_REQUIRED_DOC_TYPES - present_doc_types)


def kyc_missing_identity_fields(
    *, emirates_id: str | None, passport_number: str | None, visa_number: str | None
) -> list[str]:
    """Champs d'identité obligatoires non renseignés."""
    missing = []
    if not emirates_id:
        missing.append("emirates_id")
    if not passport_number:
        missing.append("passport_number")
    if not visa_number:
        missing.append("visa_number")
    return missing


def is_kyc_complete(
    *,
    present_doc_types: set[str],
    emirates_id: str | None,
    passport_number: str | None,
    visa_number: str | None,
    today: date,
    emirates_id_expiry: date | None,
    passport_expiry: date | None,
    visa_expiry: date | None,
) -> bool:
    """KYC complet : docs requis présents + champs d'identité remplis + rien d'expiré."""
    if kyc_missing_documents(present_doc_types):
        return False
    if kyc_missing_identity_fields(
        emirates_id=emirates_id,
        passport_number=passport_number,
        visa_number=visa_number,
    ):
        return False
    for expiry in (emirates_id_expiry, passport_expiry, visa_expiry):
        if visa_alert_level(today, expiry) == "expired":
            return False
    return True


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


# ─── KYC — fonctions async ─────────────────────────────────────────────────


async def tenant_document_types(
    db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID
) -> set[str]:
    """Types de documents (module M2) attachés à ce locataire (non supprimés)."""
    rows = await db.execute(
        select(Document.doc_type).where(
            Document.company_id == company_id,
            Document.entity_type == "tenant",
            Document.entity_id == party_id,
            Document.deleted_at.is_(None),
        )
    )
    return {dt for dt in rows.scalars().all()}


async def kyc_status_report(
    db: AsyncSession, company_id: uuid.UUID, tenant: TenantProfile, today: date
) -> dict[str, Any]:
    """Construit la checklist KYC d'un locataire (statut + manquants + alertes)."""
    present = await tenant_document_types(db, company_id, tenant.party_id)
    missing_docs = kyc_missing_documents(present)
    missing_fields = kyc_missing_identity_fields(
        emirates_id=tenant.emirates_id,
        passport_number=tenant.passport_number,
        visa_number=tenant.visa_number,
    )
    complete = is_kyc_complete(
        present_doc_types=present,
        emirates_id=tenant.emirates_id,
        passport_number=tenant.passport_number,
        visa_number=tenant.visa_number,
        today=today,
        emirates_id_expiry=tenant.emirates_id_expiry,
        passport_expiry=tenant.passport_expiry,
        visa_expiry=tenant.visa_expiry,
    )
    return {
        "kyc_status": tenant.kyc_status,
        "kyc_verified_at": tenant.kyc_verified_at,
        "kyc_rejection_reason": tenant.kyc_rejection_reason,
        "required_doc_types": sorted(kyc_required_doc_types()),
        "present_doc_types": sorted(present),
        "missing_doc_types": missing_docs,
        "missing_identity_fields": missing_fields,
        "visa_alert": visa_alert_level(today, tenant.visa_expiry),
        "emirates_id_alert": visa_alert_level(today, tenant.emirates_id_expiry),
        "passport_alert": visa_alert_level(today, tenant.passport_expiry),
        "ready_to_verify": complete,
    }


async def set_kyc_status(
    db: AsyncSession,
    company_id: uuid.UUID,
    tenant: TenantProfile,
    target: str,
    *,
    verified_by_user_id: uuid.UUID | None = None,
    rejection_reason: str | None = None,
) -> TenantProfile:
    """Applique une transition KYC déjà validée par l'appelant."""
    now = datetime.now(timezone.utc)
    tenant.kyc_status = target
    if target == "verified":
        tenant.kyc_verified_at = now
        tenant.kyc_verified_by_user_id = verified_by_user_id
        tenant.kyc_rejection_reason = None
    elif target == "rejected":
        tenant.kyc_rejection_reason = rejection_reason
    elif target == "pending":
        tenant.kyc_rejection_reason = None
    tenant.updated_at = now
    await db.commit()
    await db.refresh(tenant)
    return tenant
