"""Router FastAPI — PDC (post-dated cheques)."""

import uuid
from datetime import UTC, date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.pdc.schemas import (
    DepositCalendarEntry,
    DepositCalendarOut,
    PdcAgingSummaryOut,
    PdcBounceAction,
    PdcCreate,
    PdcDepositAction,
    PdcDetailOut,
    PdcListOut,
    PdcOut,
    PdcReplaceAction,
    PdcUpdate,
)
from app.routers.pdc.service import (
    aging_summary,
    create_pdc,
    deposit_calendar,
    get_pdc,
    increment_legal_notices,
    list_pdc,
    mark_bounced,
    mark_cancelled,
    mark_cleared,
    mark_deposited,
    replace_bounced,
    soft_delete_pdc,
    update_pdc,
)

router = APIRouter(prefix="/pdc", tags=["pdc"])


def _handle_transition_result(result):
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pdc_not_found")
    if result == "invalid_transition":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid_status_transition",
        )
    return result


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "pdc", "status": "ok"}


@router.get("/", response_model=PdcListOut)
async def list_pdc_endpoint(
    status_filter: str | None = Query(None, alias="status"),
    rental_id: uuid.UUID | None = Query(None),
    contract_id: uuid.UUID | None = Query(None),
    drawer_party_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> PdcListOut:
    company_id = await get_company_id(db)
    rows, total = await list_pdc(
        db,
        company_id,
        page,
        limit,
        status_filter,
        rental_id,
        contract_id,
        drawer_party_id,
    )
    return PdcListOut(
        data=[PdcOut.model_validate(p) for p in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=PdcDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def create_pdc_endpoint(
    body: PdcCreate,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    company_id = await get_company_id(db)
    pdc = await create_pdc(db, company_id, body)
    if pdc is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="linked_entities_not_found",
        )
    return PdcDetailOut(data=PdcOut.model_validate(pdc))


@router.get("/calendar", response_model=DepositCalendarOut)
async def deposit_calendar_endpoint(
    today: date | None = Query(None),
    horizon_days: int = Query(60, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
) -> DepositCalendarOut:
    """Calendrier des PDC à venir dans les `horizon_days` prochains jours."""
    from datetime import datetime

    company_id = await get_company_id(db)
    ref_today = today or datetime.now(UTC).date()
    entries = await deposit_calendar(db, company_id, ref_today, horizon_days)
    return DepositCalendarOut(
        data=[DepositCalendarEntry.model_validate(e) for e in entries],
        meta={"reference_date": str(ref_today), "horizon_days": horizon_days},
    )


@router.get("/aging-summary", response_model=PdcAgingSummaryOut)
async def aging_summary_endpoint(
    today: date | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
) -> PdcAgingSummaryOut:
    """Synthèse d'ancienneté des PDC en cours par tranche (overdue / due_7 /
    due_30 / later) : nombre et montant AED, plus les totaux."""
    from datetime import datetime

    company_id = await get_company_id(db)
    ref_today = today or datetime.now(UTC).date()
    summary = await aging_summary(db, company_id, ref_today)
    return PdcAgingSummaryOut(
        data={
            **summary["buckets"],
            "total_count": summary["total_count"],
            "total_amount_aed": summary["total_amount_aed"],
        },
        meta={"reference_date": str(ref_today)},
    )


@router.get("/{pdc_id}", response_model=PdcDetailOut)
async def get_pdc_endpoint(
    pdc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    company_id = await get_company_id(db)
    pdc = await get_pdc(db, company_id, pdc_id)
    if pdc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pdc_not_found")
    return PdcDetailOut(data=PdcOut.model_validate(pdc))


@router.patch(
    "/{pdc_id}",
    response_model=PdcDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def update_pdc_endpoint(
    pdc_id: uuid.UUID,
    body: PdcUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    company_id = await get_company_id(db)
    pdc = await update_pdc(db, company_id, pdc_id, body)
    if pdc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pdc_not_found")
    return PdcDetailOut(data=PdcOut.model_validate(pdc))


@router.post(
    "/{pdc_id}/deposit",
    response_model=PdcDetailOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def deposit_pdc_endpoint(
    pdc_id: uuid.UUID,
    body: PdcDepositAction,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    company_id = await get_company_id(db)
    pdc = _handle_transition_result(await mark_deposited(db, company_id, pdc_id, body.deposit_date))
    return PdcDetailOut(data=PdcOut.model_validate(pdc))


@router.post(
    "/{pdc_id}/clear",
    response_model=PdcDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def clear_pdc_endpoint(
    pdc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    company_id = await get_company_id(db)
    pdc = _handle_transition_result(await mark_cleared(db, company_id, pdc_id))
    return PdcDetailOut(data=PdcOut.model_validate(pdc))


@router.post(
    "/{pdc_id}/bounce",
    response_model=PdcDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def bounce_pdc_endpoint(
    pdc_id: uuid.UUID,
    body: PdcBounceAction,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    company_id = await get_company_id(db)
    pdc = _handle_transition_result(
        await mark_bounced(db, company_id, pdc_id, body.bounce_reason, body.bounce_fee_aed)
    )
    return PdcDetailOut(data=PdcOut.model_validate(pdc))


@router.post(
    "/{pdc_id}/cancel",
    response_model=PdcDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def cancel_pdc_endpoint(
    pdc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    company_id = await get_company_id(db)
    pdc = _handle_transition_result(await mark_cancelled(db, company_id, pdc_id))
    return PdcDetailOut(data=PdcOut.model_validate(pdc))


@router.post(
    "/{pdc_id}/replace",
    response_model=PdcDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def replace_pdc_endpoint(
    pdc_id: uuid.UUID,
    body: PdcReplaceAction,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    """Crée un nouveau PDC et chaîne l'ancien (bounced → replaced)."""
    company_id = await get_company_id(db)
    result = await replace_bounced(db, company_id, pdc_id, body.new_cheque)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="pdc_not_found_or_invalid_links",
        )
    if result == "invalid_transition":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid_status_transition",
        )
    _, new = result
    return PdcDetailOut(data=PdcOut.model_validate(new))


@router.post(
    "/{pdc_id}/legal-notice",
    response_model=PdcDetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def legal_notice_endpoint(
    pdc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> PdcDetailOut:
    """Incrémente le compteur de mises en demeure envoyées."""
    company_id = await get_company_id(db)
    pdc = await increment_legal_notices(db, company_id, pdc_id)
    if pdc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pdc_not_found")
    return PdcDetailOut(data=PdcOut.model_validate(pdc))


@router.delete(
    "/{pdc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def delete_pdc_endpoint(
    pdc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    deleted = await soft_delete_pdc(db, company_id, pdc_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pdc_not_found")
