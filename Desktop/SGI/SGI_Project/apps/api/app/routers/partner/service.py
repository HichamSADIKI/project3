"""Logique métier de l'espace Partenaire."""
import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner_commission import PartnerCommissionEntry
from app.models.partner_lead import PartnerLead
from app.models.partner_service import PartnerService
from app.models.party_owner import Owner
from app.models.property_submission import PropertySubmission
from app.models.user import User


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
