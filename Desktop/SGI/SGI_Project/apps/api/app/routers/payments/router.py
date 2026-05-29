"""Router Paiements — /api/v1/payments."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.route_deps import get_company_id, require_roles

from .schemas import (
    OwnerSummaryOut,
    PayIn,
    RequestCreate,
    RequestListOut,
    RequestOut,
)
from .service import (
    create_request,
    get_request,
    list_requests,
    owner_summary,
    pay_request,
)

router = APIRouter(prefix="/payments", tags=["payments"])


# ── Demandes de paiement ──────────────────────────────────────────────────

@router.get("/requests", response_model=RequestListOut)
async def list_reqs(
    status: str | None = Query(None),
    payment_type: str | None = Query(None),
    unit_id: uuid.UUID | None = Query(None),
    tenant_client_id: uuid.UUID | None = Query(None),
    owner_client_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> RequestListOut:
    cid = await get_company_id(db)
    items, total = await list_requests(
        db, cid, status, payment_type, unit_id,
        tenant_client_id, owner_client_id, page, limit,
    )
    pages = (total + limit - 1) // limit
    return RequestListOut(
        data=[RequestOut.model_validate(r) for r in items],
        meta={"total": total, "page": page, "limit": limit, "pages": pages},
    )


@router.post("/requests", response_model=RequestOut,
             status_code=status.HTTP_201_CREATED)
async def create_req(
    body: RequestCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> RequestOut:
    cid = await get_company_id(db)
    return RequestOut.model_validate(await create_request(db, cid, body))


@router.get("/requests/{request_id}", response_model=RequestOut)
async def get_req(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> RequestOut:
    cid = await get_company_id(db)
    req = await get_request(db, cid, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="request_not_found")
    return RequestOut.model_validate(req)


@router.post("/requests/{request_id}/pay", response_model=RequestOut)
async def pay_req(
    request_id: uuid.UUID,
    body: PayIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_roles("admin", "manager", "agent", "client")),
) -> RequestOut:
    cid = await get_company_id(db)

    # Un compte 'client' ne peut régler QUE ses propres demandes (BOLA) :
    # le tenant_client_id de la demande doit correspondre à sa fiche client.
    # Le staff (admin/manager/agent) peut régler au nom du client.
    role = getattr(request.state, "role", None)
    if role == "client":
        from app.routers.client_portal.service import find_linked_client_id
        from app.routers.payments.service import get_request
        email = getattr(request.state, "email", "") or ""
        my_client_id = await find_linked_client_id(db, email, cid)
        existing = await get_request(db, cid, request_id)
        if not existing:
            raise HTTPException(status_code=404, detail="request_not_found")
        if not my_client_id or existing.tenant_client_id != my_client_id:
            raise HTTPException(status_code=403, detail="not_your_payment_request")

    req = await pay_request(db, cid, request_id, body)
    if not req:
        raise HTTPException(status_code=404, detail="request_not_found")
    return RequestOut.model_validate(req)


# ── Résumé propriétaire ───────────────────────────────────────────────────

@router.get("/owner/{owner_client_id}/summary", response_model=OwnerSummaryOut)
async def owner_sum(
    owner_client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> OwnerSummaryOut:
    cid = await get_company_id(db)
    return OwnerSummaryOut(**await owner_summary(db, cid, owner_client_id))
