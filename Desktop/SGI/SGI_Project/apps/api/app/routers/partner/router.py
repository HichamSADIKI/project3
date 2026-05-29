"""Espace Partenaire (role=partner) — submissions, leads, commissions, services."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.route_deps import require_roles
from app.routers.partner.schemas import (
    CommissionOut,
    PartnerDashboardOut,
    PartnerLeadCreate,
    PartnerLeadOut,
    PartnerServiceCreate,
    PartnerServiceOut,
    PartnerServiceUpdate,
    PropertySubmissionCreate,
    PropertySubmissionOut,
)
from app.routers.partner.service import (
    compute_dashboard,
    create_lead,
    create_service,
    create_submission,
    list_my_commissions,
    list_my_leads,
    list_my_services,
    list_my_submissions,
    update_service,
)

router = APIRouter(
    prefix="/fournisseur",
    tags=["fournisseur"],
    dependencies=[Depends(require_roles("fournisseur"))],
)


def _ctx(request: Request) -> tuple[uuid.UUID, uuid.UUID, str]:
    user_id = getattr(request.state, "user_id", None)
    company_id = getattr(request.state, "company_id", None)
    email = getattr(request.state, "email", None)
    if not user_id or not company_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="not_authenticated"
        )
    return uuid.UUID(user_id), uuid.UUID(company_id), email or ""


# ── Dashboard ────────────────────────────────────────────────────────────
@router.get("/dashboard", response_model=PartnerDashboardOut)
async def get_dashboard(
    request: Request, db: AsyncSession = Depends(get_db)
) -> PartnerDashboardOut:
    user_id, company_id, email = _ctx(request)
    data = await compute_dashboard(
        db, partner_user_id=user_id, partner_email=email, company_id=company_id
    )
    return PartnerDashboardOut(**data)


# ── Submissions ──────────────────────────────────────────────────────────
@router.get("/submissions", response_model=list[PropertySubmissionOut])
async def list_submissions(
    request: Request, db: AsyncSession = Depends(get_db)
) -> list[PropertySubmissionOut]:
    user_id, company_id, _ = _ctx(request)
    items = await list_my_submissions(db, user_id, company_id)
    return [PropertySubmissionOut.model_validate(i) for i in items]


@router.post(
    "/submissions",
    response_model=PropertySubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_submission(
    body: PropertySubmissionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> PropertySubmissionOut:
    user_id, company_id, _ = _ctx(request)
    sub = await create_submission(
        db,
        partner_user_id=user_id,
        company_id=company_id,
        data=body.model_dump(),
    )
    await db.commit()
    return PropertySubmissionOut.model_validate(sub)


# ── Leads ────────────────────────────────────────────────────────────────
@router.get("/leads", response_model=list[PartnerLeadOut])
async def list_leads(
    request: Request, db: AsyncSession = Depends(get_db)
) -> list[PartnerLeadOut]:
    user_id, company_id, _ = _ctx(request)
    leads = await list_my_leads(db, user_id, company_id)
    return [PartnerLeadOut.model_validate(le) for le in leads]


@router.post(
    "/leads", response_model=PartnerLeadOut, status_code=status.HTTP_201_CREATED
)
async def post_lead(
    body: PartnerLeadCreate, request: Request, db: AsyncSession = Depends(get_db)
) -> PartnerLeadOut:
    user_id, company_id, _ = _ctx(request)
    data = body.model_dump()
    # email arrive comme EmailStr-str ; FastAPI le sérialise déjà → on le passe brut
    lead = await create_lead(
        db, partner_user_id=user_id, company_id=company_id, data=data
    )
    await db.commit()
    return PartnerLeadOut.model_validate(lead)


# ── Commissions ──────────────────────────────────────────────────────────
@router.get("/commissions", response_model=list[CommissionOut])
async def list_commissions(
    request: Request, db: AsyncSession = Depends(get_db)
) -> list[CommissionOut]:
    user_id, company_id, _ = _ctx(request)
    items = await list_my_commissions(db, user_id, company_id)
    return [CommissionOut.model_validate(i) for i in items]


# ── Services ─────────────────────────────────────────────────────────────
@router.get("/services", response_model=list[PartnerServiceOut])
async def list_services(
    request: Request, db: AsyncSession = Depends(get_db)
) -> list[PartnerServiceOut]:
    user_id, company_id, _ = _ctx(request)
    items = await list_my_services(db, user_id, company_id)
    return [PartnerServiceOut.model_validate(i) for i in items]


@router.post(
    "/services",
    response_model=PartnerServiceOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_service(
    body: PartnerServiceCreate, request: Request, db: AsyncSession = Depends(get_db)
) -> PartnerServiceOut:
    user_id, company_id, _ = _ctx(request)
    svc = await create_service(
        db, partner_user_id=user_id, company_id=company_id, data=body.model_dump()
    )
    await db.commit()
    return PartnerServiceOut.model_validate(svc)


@router.patch("/services/{service_id}", response_model=PartnerServiceOut)
async def patch_service(
    service_id: uuid.UUID,
    body: PartnerServiceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> PartnerServiceOut:
    user_id, _, _ = _ctx(request)
    svc = await update_service(
        db,
        partner_user_id=user_id,
        service_id=service_id,
        updates=body.model_dump(exclude_unset=True),
    )
    if not svc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="service_not_found"
        )
    await db.commit()
    return PartnerServiceOut.model_validate(svc)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "fournisseur", "status": "ok"}
