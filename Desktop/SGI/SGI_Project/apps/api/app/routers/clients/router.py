"""Router FastAPI — Clients."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.clients.schemas import (
    ClientCreate,
    ClientDetailOut,
    ClientListOut,
    ClientOut,
    ClientUpdate,
)
from app.routers.clients.service import (
    create_client,
    delete_client,
    get_client,
    list_clients,
    update_client,
)

router = APIRouter(prefix="/clients", tags=["clients"])


def _get_company_id(request: Request) -> uuid.UUID:
    """Récupère le company_id depuis l'état de la requête (posé par TenantMiddleware
    à partir du JWT). Aligné sur les autres routers (auth.me, client_portal…)."""
    raw = getattr(request.state, "company_id", None)
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
    return {"module": "clients", "status": "ok"}


@router.get("/", response_model=ClientListOut)
async def list_clients_endpoint(
    request: Request,
    type: str | None = Query(None, alias="type", pattern="^(individual|company)$"),
    q: str | None = Query(None, description="Recherche fulltext"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> ClientListOut:
    company_id = _get_company_id(request)
    clients, total = await list_clients(db, company_id, page, limit, type, q)
    return ClientListOut(
        data=[ClientOut.model_validate(c) for c in clients],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=ClientDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def create_client_endpoint(
    body: ClientCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ClientDetailOut:
    company_id = _get_company_id(request)
    client = await create_client(db, company_id, body)
    return ClientDetailOut(data=ClientOut.model_validate(client))


@router.get("/{client_id}", response_model=ClientDetailOut)
async def get_client_endpoint(
    client_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ClientDetailOut:
    company_id = _get_company_id(request)
    client = await get_client(db, company_id, client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="client_not_found")
    return ClientDetailOut(data=ClientOut.model_validate(client))


@router.patch(
    "/{client_id}",
    response_model=ClientDetailOut,
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def update_client_endpoint(
    client_id: uuid.UUID,
    body: ClientUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ClientDetailOut:
    company_id = _get_company_id(request)
    client = await update_client(db, company_id, client_id, body)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="client_not_found")
    return ClientDetailOut(data=ClientOut.model_validate(client))


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_require_roles("admin", "manager"))],
)
async def delete_client_endpoint(
    client_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = _get_company_id(request)
    deleted = await delete_client(db, company_id, client_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="client_not_found")
