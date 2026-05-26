"""Router FastAPI — Contracts."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.routers.contracts.schemas import (
    ContractCreate,
    ContractDetailOut,
    ContractListOut,
    ContractOut,
    ContractUpdate,
)
from app.routers.contracts.service import (
    create_contract,
    delete_contract,
    get_contract,
    list_contracts,
    update_contract,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    """Récupère le company_id depuis la session PostgreSQL (injecté par le middleware JWT)."""
    result = await db.execute(
        sql_text("SELECT current_setting('app.current_company_id', true)")
    )
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_context_missing",
        )
    return uuid.UUID(raw)


def _require_roles(*allowed_roles: str):
    """Dépendance FastAPI vérifiant le rôle de l'utilisateur."""

    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient_permissions",
            )

    return _check


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "contracts", "status": "ok"}


@router.get("/", response_model=ContractListOut)
async def list_contracts_endpoint(
    type: str | None = Query(None, pattern="^(sale|rental)$"),
    status_filter: str | None = Query(
        None,
        alias="status",
        pattern="^(draft|signed|active|expired|cancelled)$",
    ),
    client_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ContractListOut:
    company_id = await _get_company_id(db)
    contracts, total = await list_contracts(
        db, company_id, page, limit, type, status_filter, client_id
    )
    return ContractListOut(
        data=[ContractOut.model_validate(c) for c in contracts],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=ContractDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def create_contract_endpoint(
    body: ContractCreate,
    db: AsyncSession = Depends(get_db),
) -> ContractDetailOut:
    company_id = await _get_company_id(db)
    contract = await create_contract(db, company_id, body)
    return ContractDetailOut(data=ContractOut.model_validate(contract))


@router.get("/{contract_id}", response_model=ContractDetailOut)
async def get_contract_endpoint(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ContractDetailOut:
    company_id = await _get_company_id(db)
    contract = await get_contract(db, company_id, contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found"
        )
    return ContractDetailOut(data=ContractOut.model_validate(contract))


@router.patch(
    "/{contract_id}",
    response_model=ContractDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager"))],
)
async def update_contract_endpoint(
    contract_id: uuid.UUID,
    body: ContractUpdate,
    db: AsyncSession = Depends(get_db),
) -> ContractDetailOut:
    company_id = await _get_company_id(db)
    try:
        contract = await update_contract(db, company_id, contract_id, body)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found"
        )
    return ContractDetailOut(data=ContractOut.model_validate(contract))


@router.delete(
    "/{contract_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_require_roles("admin", "manager"))],
)
async def delete_contract_endpoint(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    company_id = await _get_company_id(db)
    try:
        deleted = await delete_contract(db, company_id, contract_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found"
        )
