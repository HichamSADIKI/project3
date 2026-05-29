"""Router IA — /api/v1/ai."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.route_deps import get_company_id, require_roles

from .schemas import (
    ContractSummaryOut,
    PredictionListOut,
    PredictionOut,
    RiskOut,
)
from .service import contract_summary, predictions, unit_risk

router = APIRouter(prefix="/ai", tags=["ai_services"])


@router.post("/contracts/{contract_id}/summary", response_model=ContractSummaryOut)
async def ai_contract_summary(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> ContractSummaryOut:
    cid = await get_company_id(db)
    data = await contract_summary(db, cid, contract_id)
    if not data:
        raise HTTPException(status_code=404, detail="contract_not_found")
    return ContractSummaryOut(**data)


@router.get("/maintenance/risk", response_model=RiskOut)
async def ai_unit_risk(
    unit_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> RiskOut:
    cid = await get_company_id(db)
    data = await unit_risk(db, cid, unit_id)
    return RiskOut(
        unit_id=data["unit_id"],
        ticket_count=data["ticket_count"],
        recurring_category=data["recurring_category"],
        sla_breaches=data["sla_breaches"],
        risk_score=data["risk_score"],
        risk_level=data["risk_level"],
    )


@router.get("/maintenance/predictions", response_model=PredictionListOut)
async def ai_predictions(
    min_score: int = Query(25, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_roles("admin", "manager")),
) -> PredictionListOut:
    cid = await get_company_id(db)
    rows = await predictions(db, cid, min_score)
    return PredictionListOut(
        data=[PredictionOut(**r) for r in rows],
        meta={"count": len(rows), "min_score": min_score},
    )
