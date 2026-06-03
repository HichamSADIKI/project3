"""Router FastAPI — Sources.

Ingestion multi-source → leads CRM. Tout est filtré par `company_id` (Loi 1),
gardé par rôle (`admin`/`manager`/`agent`). L'idempotence (réimport d'un même
`external_id` ne crée pas de doublon) et la journalisation des rejets sont
assurées par le service. Anti-BOLA : 404 — jamais 403 — sur une cible hors
tenant.
"""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.sources import service
from app.routers.sources.schemas import (
    CsvImportBody,
    ImportSummary,
    ImportSummaryOut,
    SourceImportItemOut,
    SourceImportListOut,
    SourceImportOut,
    WebhookImportBody,
)

router = APIRouter(prefix="/sources", tags=["sources"])

_WRITE_ROLES = ("admin", "manager", "agent")


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    try:
        return uuid.UUID(raw)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        ) from None


def _get_user_id(request: Request) -> uuid.UUID | None:
    raw = getattr(request.state, "user_id", None)
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except (ValueError, TypeError):
        return None


def _require_roles(*allowed_roles: str) -> Callable[[Request], Awaitable[None]]:
    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions"
            )

    return _check


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "sources", "status": "ok"}


# ── Ingestion ───────────────────────────────────────────────────────────────


@router.post(
    "/imports/csv",
    response_model=ImportSummaryOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager"))],
)
async def import_csv_endpoint(
    body: CsvImportBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ImportSummaryOut:
    company_id = _get_company_id(request)
    summary = await service.ingest_csv(
        db,
        company_id,
        body.rows,
        source_type=body.source_type,
        source_channel=body.source_channel,
        agent_user_id=_get_user_id(request),
    )
    return ImportSummaryOut(data=ImportSummary(**summary))


@router.post(
    "/imports/webhook",
    response_model=SourceImportItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def import_webhook_endpoint(
    body: WebhookImportBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SourceImportItemOut:
    company_id = _get_company_id(request)
    record, _outcome = await service.ingest_record(
        db,
        company_id,
        source_type=body.source_type,
        source_channel=body.source_channel or f"webhook:{body.source_type}",
        external_id=body.external_id,
        raw=body.payload,
        agent_user_id=_get_user_id(request),
    )
    return SourceImportItemOut(data=SourceImportOut.model_validate(record))


# ── Journal / provenance ──────────────────────────────────────────────────────


@router.get(
    "/imports",
    response_model=SourceImportListOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def list_imports_endpoint(
    request: Request,
    source_type: str | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    source_channel: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> SourceImportListOut:
    company_id = _get_company_id(request)
    imports, total = await service.list_imports(
        db,
        company_id,
        page=page,
        limit=limit,
        source_type=source_type,
        status=status_,
        source_channel=source_channel,
    )
    return SourceImportListOut(
        data=[SourceImportOut.model_validate(item) for item in imports],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.get(
    "/imports/{import_id}",
    response_model=SourceImportItemOut,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def get_import_endpoint(
    import_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SourceImportItemOut:
    company_id = _get_company_id(request)
    record = await service.get_import(db, company_id, import_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="import_not_found")
    return SourceImportItemOut(data=SourceImportOut.model_validate(record))
