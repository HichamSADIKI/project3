"""Endpoints Recherche globale back-office.

GET  /search          — recherche unifiée biens/clients/contrats (typeahead).
POST /search/reindex  — (ré)indexe la société courante dans Meilisearch.

Tout est scopé `company_id` (Loi 1). La lecture exige une session authentifiée
avec rôle ; la réindexation est réservée admin/manager.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import require_roles
from app.routers.search import meili, schemas, service

router = APIRouter(prefix="/search", tags=["search"])


@router.get(
    "",
    response_model=schemas.SearchResultOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def global_search(
    q: str = Query("", max_length=200),
    types: str | None = Query(None, description="CSV: property,client,contract"),
    limit: int = Query(8, ge=1, le=25),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Recherche unifiée (Meili si peuplé, repli DB). `meta.source` indique l'origine."""
    hits, source = await service.global_search(db, q, types, limit)
    return {
        "success": True,
        "data": hits,
        "meta": {"total": len(hits), "source": source, "limit": limit},
    }


@router.post(
    "/reindex",
    response_model=schemas.ReindexOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def reindex(db: AsyncSession = Depends(get_db_session)) -> dict[str, Any]:
    """(Ré)indexe biens/clients/contrats de la société courante dans Meilisearch.

    Best-effort : si Meili est indisponible, `indexed=0` (la recherche retombera
    sur la DB) ; `available` = nb de documents éligibles côté société."""
    cid = await service._company_id(db)
    docs = await service.collect_docs(db, cid)
    try:
        count = await meili.reindex(cid, docs)
    except Exception:  # noqa: BLE001 — Meili best-effort
        count = 0
    return {"success": True, "data": {"indexed": count, "available": len(docs)}}
