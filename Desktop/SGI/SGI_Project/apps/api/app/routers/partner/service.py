"""Logique métier de l'espace Partenaire."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.partner_commission import PartnerCommissionEntry
from app.models.partner_lead import PartnerLead
from app.models.partner_service import PartnerService
from app.models.party_owner import Owner
from app.models.party_vendor import Vendor
from app.models.property_submission import PropertySubmission
from app.models.user import User, UserRole
from app.models.vendor_document import VendorDocument
from app.models.vendor_mission import VendorMission

# ── Helpers métier purs (testables sans DB) ─────────────────────────────────

# Machine à états des missions fournisseur.
_MISSION_TRANSITIONS: dict[str, set[str]] = {
    "assigned": {"accepted", "cancelled"},
    "accepted": {"in_progress", "cancelled"},
    "in_progress": {"done", "cancelled"},
    "done": set(),
    "cancelled": set(),
}


def is_valid_mission_transition(current: str, target: str) -> bool:
    """True si la transition de statut de mission est autorisée."""
    return target in _MISSION_TRANSITIONS.get(current, set())


def document_status(expiry_date: date | None, today: date) -> str:
    """Statut effectif d'un document selon son expiration."""
    if expiry_date is not None and expiry_date < today:
        return "expired"
    return "active"


def days_until_expiry(expiry_date: date | None, today: date) -> int | None:
    """Jours restants avant expiration (négatif si déjà expiré), None si pas de date."""
    if expiry_date is None:
        return None
    return (expiry_date - today).days


# ── Profil fournisseur ─────────────────────────────────────────────────────
async def get_account_user(
    db: AsyncSession, user_id: uuid.UUID
) -> User | None:
    return (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()


async def get_my_vendor_profile(
    db: AsyncSession, partner_user_id: uuid.UUID, company_id: uuid.UUID
) -> Vendor | None:
    """Profil prestataire (vendors) rattaché au compte fournisseur courant."""
    return (
        await db.execute(
            select(Vendor).where(
                Vendor.account_user_id == partner_user_id,
                Vendor.company_id == company_id,
                Vendor.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


# ── Submissions ──────────────────────────────────────────────────────────
async def list_my_submissions(
    db: AsyncSession, partner_user_id: uuid.UUID, company_id: uuid.UUID
) -> list[PropertySubmission]:
    result = await db.execute(
        select(PropertySubmission)
        .where(
            PropertySubmission.submitter_user_id == partner_user_id,
            PropertySubmission.company_id == company_id,
            PropertySubmission.deleted_at.is_(None),
        )
        .order_by(PropertySubmission.created_at.desc())
    )
    return list(result.scalars().all())


async def create_submission(
    db: AsyncSession,
    *,
    partner_user_id: uuid.UUID,
    company_id: uuid.UUID,
    data: dict,
) -> PropertySubmission:
    sub = PropertySubmission(
        id=uuid.uuid4(),
        company_id=company_id,
        submitter_user_id=partner_user_id,
        status="pending",
        **data,
    )
    db.add(sub)
    await db.flush()
    return sub


# ── Leads ────────────────────────────────────────────────────────────────
async def list_my_leads(
    db: AsyncSession, partner_user_id: uuid.UUID, company_id: uuid.UUID
) -> list[PartnerLead]:
    result = await db.execute(
        select(PartnerLead)
        .where(
            PartnerLead.submitter_user_id == partner_user_id,
            PartnerLead.company_id == company_id,
            PartnerLead.deleted_at.is_(None),
        )
        .order_by(PartnerLead.created_at.desc())
    )
    return list(result.scalars().all())


async def create_lead(
    db: AsyncSession,
    *,
    partner_user_id: uuid.UUID,
    company_id: uuid.UUID,
    data: dict,
) -> PartnerLead:
    lead = PartnerLead(
        id=uuid.uuid4(),
        company_id=company_id,
        submitter_user_id=partner_user_id,
        status="new",
        **data,
    )
    db.add(lead)
    await db.flush()
    return lead


# ── Commissions ──────────────────────────────────────────────────────────
async def list_my_commissions(
    db: AsyncSession, partner_user_id: uuid.UUID, company_id: uuid.UUID
) -> list[PartnerCommissionEntry]:
    result = await db.execute(
        select(PartnerCommissionEntry)
        .where(
            PartnerCommissionEntry.partner_user_id == partner_user_id,
            PartnerCommissionEntry.company_id == company_id,
        )
        .order_by(PartnerCommissionEntry.created_at.desc())
    )
    return list(result.scalars().all())


# ── Services ─────────────────────────────────────────────────────────────
async def list_my_services(
    db: AsyncSession, partner_user_id: uuid.UUID, company_id: uuid.UUID
) -> list[PartnerService]:
    result = await db.execute(
        select(PartnerService)
        .where(
            PartnerService.partner_user_id == partner_user_id,
            PartnerService.company_id == company_id,
            PartnerService.deleted_at.is_(None),
        )
        .order_by(PartnerService.created_at.desc())
    )
    return list(result.scalars().all())


async def create_service(
    db: AsyncSession,
    *,
    partner_user_id: uuid.UUID,
    company_id: uuid.UUID,
    data: dict,
) -> PartnerService:
    svc = PartnerService(
        id=uuid.uuid4(),
        company_id=company_id,
        partner_user_id=partner_user_id,
        is_active=True,
        **data,
    )
    db.add(svc)
    await db.flush()
    return svc


async def update_service(
    db: AsyncSession,
    *,
    partner_user_id: uuid.UUID,
    service_id: uuid.UUID,
    updates: dict,
) -> PartnerService | None:
    result = await db.execute(
        select(PartnerService).where(
            PartnerService.id == service_id,
            PartnerService.partner_user_id == partner_user_id,
            PartnerService.deleted_at.is_(None),
        )
    )
    svc = result.scalar_one_or_none()
    if not svc:
        return None
    for key, value in updates.items():
        if value is not None:
            setattr(svc, key, value)
    await db.flush()
    return svc


# ── Dashboard ────────────────────────────────────────────────────────────
async def compute_dashboard(
    db: AsyncSession,
    *,
    partner_user_id: uuid.UUID,
    partner_email: str,
    company_id: uuid.UUID,
) -> dict:
    """Agrégats pour le dashboard partenaire.

    Note : les mandats actifs sont calculés via la table `owners` qui lie
    le propriétaire (party Client) au mandat. On retrouve la party par email.
    """
    pending_submissions = (
        await db.execute(
            select(func.count(PropertySubmission.id)).where(
                PropertySubmission.submitter_user_id == partner_user_id,
                PropertySubmission.company_id == company_id,
                PropertySubmission.status == "pending",
                PropertySubmission.deleted_at.is_(None),
            )
        )
    ).scalar_one() or 0

    active_leads = (
        await db.execute(
            select(func.count(PartnerLead.id)).where(
                PartnerLead.submitter_user_id == partner_user_id,
                PartnerLead.company_id == company_id,
                PartnerLead.status.in_(("new", "contacted", "qualified")),
                PartnerLead.deleted_at.is_(None),
            )
        )
    ).scalar_one() or 0

    converted_leads = (
        await db.execute(
            select(func.count(PartnerLead.id)).where(
                PartnerLead.submitter_user_id == partner_user_id,
                PartnerLead.company_id == company_id,
                PartnerLead.status == "converted",
                PartnerLead.deleted_at.is_(None),
            )
        )
    ).scalar_one() or 0

    commissions_pending = (
        await db.execute(
            select(
                func.coalesce(func.sum(PartnerCommissionEntry.commission_amount_aed), 0)
            ).where(
                PartnerCommissionEntry.partner_user_id == partner_user_id,
                PartnerCommissionEntry.company_id == company_id,
                PartnerCommissionEntry.status.in_(("pending", "payable")),
            )
        )
    ).scalar_one() or Decimal("0")

    commissions_paid = (
        await db.execute(
            select(
                func.coalesce(func.sum(PartnerCommissionEntry.commission_amount_aed), 0)
            ).where(
                PartnerCommissionEntry.partner_user_id == partner_user_id,
                PartnerCommissionEntry.company_id == company_id,
                PartnerCommissionEntry.status == "paid",
            )
        )
    ).scalar_one() or Decimal("0")

    active_services = (
        await db.execute(
            select(func.count(PartnerService.id)).where(
                PartnerService.partner_user_id == partner_user_id,
                PartnerService.company_id == company_id,
                PartnerService.is_active.is_(True),
                PartnerService.deleted_at.is_(None),
            )
        )
    ).scalar_one() or 0

    # Mandats actifs : via owners liés à un party Client ayant l'email du partner.
    # Si le partenaire n'est pas aussi un propriétaire, le count sera 0 — c'est OK.
    active_mandates = 0
    if partner_email:
        from app.models.client import Client  # local pour éviter cycle import

        client_ids_subq = select(Client.id).where(
            Client.email == partner_email,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
        active_mandates = (
            await db.execute(
                select(func.count(Owner.party_id)).where(
                    Owner.party_id.in_(client_ids_subq),
                    Owner.company_id == company_id,
                    Owner.deleted_at.is_(None),
                )
            )
        ).scalar_one() or 0

    return {
        "active_mandates": int(active_mandates),
        "pending_submissions": int(pending_submissions),
        "active_leads": int(active_leads),
        "converted_leads": int(converted_leads),
        "commissions_pending_aed": Decimal(commissions_pending),
        "commissions_paid_aed": Decimal(commissions_paid),
        "active_services": int(active_services),
    }


# ── Documents KYC ───────────────────────────────────────────────────────────
async def list_my_documents(
    db: AsyncSession, vendor_party_id: uuid.UUID, company_id: uuid.UUID
) -> list[VendorDocument]:
    result = await db.execute(
        select(VendorDocument)
        .where(
            VendorDocument.vendor_party_id == vendor_party_id,
            VendorDocument.company_id == company_id,
            VendorDocument.deleted_at.is_(None),
        )
        .order_by(VendorDocument.created_at.desc())
    )
    return list(result.scalars().all())


async def create_document(
    db: AsyncSession,
    *,
    vendor_party_id: uuid.UUID,
    company_id: uuid.UUID,
    doc_type: str,
    file_path: str,
    original_filename: str | None,
    expiry_date: date | None,
    extracted: dict,
) -> VendorDocument:
    doc = VendorDocument(
        id=uuid.uuid4(),
        company_id=company_id,
        vendor_party_id=vendor_party_id,
        doc_type=doc_type,
        file_path=file_path,
        original_filename=original_filename,
        expiry_date=expiry_date,
        extracted=extracted or {},
        status="active",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


# ── Missions / interventions ────────────────────────────────────────────────
async def list_my_missions(
    db: AsyncSession, vendor_party_id: uuid.UUID, company_id: uuid.UUID
) -> list[VendorMission]:
    result = await db.execute(
        select(VendorMission)
        .where(
            VendorMission.vendor_party_id == vendor_party_id,
            VendorMission.company_id == company_id,
            VendorMission.deleted_at.is_(None),
        )
        .order_by(VendorMission.created_at.desc())
    )
    return list(result.scalars().all())


async def get_mission(
    db: AsyncSession, mission_id: uuid.UUID, vendor_party_id: uuid.UUID, company_id: uuid.UUID
) -> VendorMission | None:
    return (
        await db.execute(
            select(VendorMission).where(
                VendorMission.id == mission_id,
                VendorMission.vendor_party_id == vendor_party_id,
                VendorMission.company_id == company_id,
                VendorMission.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


async def set_mission_status(
    db: AsyncSession, mission: VendorMission, target: str
) -> VendorMission:
    mission.status = target
    if target == "done":
        mission.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(mission)
    return mission


# ── Messagerie agence ───────────────────────────────────────────────────────
async def resolve_agency_recipient(
    db: AsyncSession, company_id: uuid.UUID
) -> uuid.UUID | None:
    """Boîte de réception « agence » : premier admin/manager actif du tenant."""
    return (
        await db.execute(
            select(User.id)
            .where(
                User.company_id == company_id,
                User.role.in_([UserRole.ADMIN.value, UserRole.MANAGER.value]),
                User.status == "active",
                User.deleted_at.is_(None),
            )
            .order_by(User.created_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_my_messages(
    db: AsyncSession, user_id: uuid.UUID, company_id: uuid.UUID
) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(
            Message.company_id == company_id,
            Message.deleted_at.is_(None),
            or_(
                Message.sender_user_id == user_id,
                Message.recipient_user_id == user_id,
            ),
        )
        .order_by(Message.created_at.desc())
    )
    return list(result.scalars().all())


async def send_message_to_agency(
    db: AsyncSession,
    *,
    sender_user_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
    company_id: uuid.UUID,
    subject: str | None,
    body: str,
) -> Message:
    msg = Message(
        id=uuid.uuid4(),
        company_id=company_id,
        sender_user_id=sender_user_id,
        recipient_user_id=recipient_user_id,
        subject=subject,
        body=body,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg
