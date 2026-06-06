"""Router FastAPI — Contracts."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.contracts.contract_pdf import ContractPdfError, generate_and_store_contract
from app.routers.contracts.schemas import (
    ContractCreate,
    ContractDetailOut,
    ContractListOut,
    ContractOut,
    ContractRenew,
    ContractUpdate,
    ExpiringContractsOut,
    SignatureLink,
)
from app.routers.contracts.service import (
    create_contract,
    delete_contract,
    expiring_contracts,
    get_contract,
    link_signing_document,
    list_contracts,
    renew_contract,
    sync_contract_signature,
    update_contract,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    """Récupère le company_id depuis la session PostgreSQL (injecté par le middleware JWT)."""
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
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
    db: AsyncSession = Depends(get_db_session),
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
    db: AsyncSession = Depends(get_db_session),
) -> ContractDetailOut:
    company_id = await _get_company_id(db)
    contract = await create_contract(db, company_id, body)
    return ContractDetailOut(data=ContractOut.model_validate(contract))


@router.get("/expiring", response_model=ExpiringContractsOut)
async def expiring_contracts_endpoint(
    days: int = Query(90, ge=1, le=730),
    db: AsyncSession = Depends(get_db_session),
) -> ExpiringContractsOut:
    """Contrats actifs arrivant à échéance (ou en retard) dans `days` jours, avec
    l'éligibilité au renouvellement et les dates de renouvellement suggérées."""
    from datetime import UTC, datetime

    company_id = await _get_company_id(db)
    today = datetime.now(UTC).date()
    entries = await expiring_contracts(db, company_id, today, days)
    return ExpiringContractsOut(
        data=entries, meta={"reference_date": str(today), "horizon_days": days}
    )


@router.get("/{contract_id}", response_model=ContractDetailOut)
async def get_contract_endpoint(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> ContractDetailOut:
    company_id = await _get_company_id(db)
    contract = await get_contract(db, company_id, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found")
    return ContractDetailOut(data=ContractOut.model_validate(contract))


@router.post(
    "/{contract_id}/pdf",
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def generate_contract_pdf_endpoint(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    """Génère le PDF du contrat (WeasyPrint), le stocke dans MinIO et renvoie une
    URL présignée. Scopé `company_id` (Loi 1) ; 404 si contrat absent/autre tenant."""
    company_id = await _get_company_id(db)
    try:
        url = await generate_and_store_contract(db, company_id, contract_id)
    except ContractPdfError as exc:
        if exc.code == "contract_not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found"
            ) from None
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=exc.code
        ) from None
    return {"success": True, "data": {"url": url}}


@router.patch(
    "/{contract_id}",
    response_model=ContractDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager"))],
)
async def update_contract_endpoint(
    contract_id: uuid.UUID,
    body: ContractUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> ContractDetailOut:
    company_id = await _get_company_id(db)
    try:
        contract = await update_contract(db, company_id, contract_id, body)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found")
    return ContractDetailOut(data=ContractOut.model_validate(contract))


@router.delete(
    "/{contract_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_require_roles("admin", "manager"))],
)
async def delete_contract_endpoint(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await _get_company_id(db)
    try:
        deleted = await delete_contract(db, company_id, contract_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found")


# ─── Renouvellement & e-signature (M5) ──────────────────────────────────────


@router.post(
    "/{contract_id}/renew",
    response_model=ContractDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def renew_contract_endpoint(
    contract_id: uuid.UUID,
    body: ContractRenew,
    db: AsyncSession = Depends(get_db_session),
) -> ContractDetailOut:
    """Crée un contrat renouvelé (draft) lié au parent ; renouvelle aussi le bail
    si le contrat est de type rental."""
    company_id = await _get_company_id(db)
    result = await renew_contract(db, company_id, contract_id, body)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found")
    if result == "not_renewable":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="contract_not_renewable")
    return ContractDetailOut(data=ContractOut.model_validate(result))


@router.post(
    "/{contract_id}/request-signature",
    response_model=ContractDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def request_signature_endpoint(
    contract_id: uuid.UUID,
    body: SignatureLink,
    db: AsyncSession = Depends(get_db_session),
) -> ContractDetailOut:
    """Lie un document M2 (PDF du contrat) au contrat pour la signature. Les
    demandes de signature elles-mêmes sont créées via le module documents."""
    company_id = await _get_company_id(db)
    contract = await link_signing_document(db, company_id, contract_id, body.document_id)
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found")
    return ContractDetailOut(data=ContractOut.model_validate(contract))


@router.post(
    "/{contract_id}/sync-signature",
    response_model=ContractDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def sync_signature_endpoint(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> ContractDetailOut:
    """Synchronise le statut du contrat avec les signatures de son document M2
    (passe `signed` quand toutes les signatures sont posées)."""
    company_id = await _get_company_id(db)
    result = await sync_contract_signature(db, company_id, contract_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="contract_not_found")
    if result == "no_signing_document":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="no_signing_document_linked"
        )
    return ContractDetailOut(data=ContractOut.model_validate(result))
