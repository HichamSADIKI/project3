"""Espace Propriétaire (Owner) — /api/v1/owner.

Le propriétaire se connecte avec role=client ; il est lié à une fiche
`clients` par email, elle-même étendue par un profil `owners` (party_id).
Ces endpoints exposent ses biens, ses revenus et l'approbation de dépenses.
"""
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.route_deps import require_roles
from app.models.building import Building
from app.models.payment import PaymentRequest
from app.routers.client_portal.service import find_linked_client_id
from app.routers.payments.service import owner_summary

router = APIRouter(
    prefix="/owner",
    tags=["owner_portal"],
    dependencies=[Depends(require_roles("client", "admin", "manager"))],
)


def _ctx(request: Request) -> tuple[uuid.UUID, uuid.UUID, str]:
    uid = getattr(request.state, "user_id", None)
    cid = getattr(request.state, "company_id", None)
    email = getattr(request.state, "email", None)
    if not uid or not cid:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return uuid.UUID(uid), uuid.UUID(cid), email or ""


async def _owner_client_id(db: AsyncSession, email: str, company_id: uuid.UUID) -> uuid.UUID | None:
    return await find_linked_client_id(db, email, company_id)


# ── Dashboard ──────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def owner_dashboard(request: Request, db: AsyncSession = Depends(get_db)):
    _uid, cid, email = _ctx(request)
    owner_id = await _owner_client_id(db, email, cid)
    if not owner_id:
        return {"properties_count": 0, "total_received_aed": 0,
                "pending_aed": 0, "overdue_aed": 0}

    props = (await db.execute(
        select(Building.id).where(
            Building.company_id == cid,
            Building.owner_party_id == owner_id,
            Building.deleted_at.is_(None),
        )
    )).all()

    summary = await owner_summary(db, cid, owner_id)
    return {
        "properties_count": len(props),
        "total_received_aed": str(summary["total_received_aed"]),
        "pending_aed": str(summary["pending_aed"]),
        "overdue_aed": str(summary["overdue_aed"]),
        "requests_count": summary["requests_count"],
    }


# ── Biens du propriétaire ────────────────────────────────────────────────

@router.get("/properties")
async def owner_properties(request: Request, db: AsyncSession = Depends(get_db)):
    _uid, cid, email = _ctx(request)
    owner_id = await _owner_client_id(db, email, cid)
    if not owner_id:
        return []
    rows = (await db.execute(
        select(Building).where(
            Building.company_id == cid,
            Building.owner_party_id == owner_id,
            Building.deleted_at.is_(None),
        ).order_by(Building.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": str(b.id),
            "name": b.name_en or b.name_fr or b.name_ar,
            "name_ar": b.name_ar, "name_en": b.name_en, "name_fr": b.name_fr,
        }
        for b in rows
    ]


# ── Revenus / paiements reçus ────────────────────────────────────────────

@router.get("/revenues")
async def owner_revenues(
    request: Request,
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    _uid, cid, email = _ctx(request)
    owner_id = await _owner_client_id(db, email, cid)
    if not owner_id:
        return []
    filters = [
        PaymentRequest.company_id == cid,
        PaymentRequest.owner_client_id == owner_id,
        PaymentRequest.deleted_at.is_(None),
    ]
    if status:
        filters.append(PaymentRequest.status == status)
    rows = (await db.execute(
        select(PaymentRequest).where(*filters)
        .order_by(PaymentRequest.due_date.desc())
    )).scalars().all()
    return [
        {
            "id": str(r.id), "reference": r.reference,
            "payment_type": r.payment_type, "status": r.status,
            "amount_aed": str(r.amount_aed),
            "due_date": r.due_date.isoformat() if r.due_date else None,
            "paid_at": r.paid_at.isoformat() if r.paid_at else None,
        }
        for r in rows
    ]


# ── Approbation de dépenses (devis maintenance) ──────────────────────────

@router.post("/expenses/{quote_id}/approve")
async def approve_expense(
    quote_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)
):
    """Le propriétaire approuve un devis de maintenance le concernant."""
    from app.routers.maintenance.service import approve_quote
    _uid, cid, _email = _ctx(request)
    quote = await approve_quote(db, cid, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="quote_not_found")
    return {"id": str(quote.id), "status": quote.status}


@router.post("/expenses/{quote_id}/reject")
async def reject_expense(
    quote_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)
):
    from app.routers.maintenance.service import reject_quote
    _uid, cid, _email = _ctx(request)
    quote = await reject_quote(db, cid, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="quote_not_found")
    return {"id": str(quote.id), "status": quote.status}
