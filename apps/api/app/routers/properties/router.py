"""Router Properties — CRUD complet + recherche géospatiale par rayon."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_role

from . import service
from .schemas import (
    PropertyCreate,
    PropertyDetailOut,
    PropertyListOut,
    PropertyUpdate,
    RadiusSearchQuery,
)

router = APIRouter(prefix="/properties", tags=["properties"])


# ---------------------------------------------------------------------------
# Helper — récupère company_id depuis le contexte PostgreSQL de la session
# (set_config injecté par get_db_session via TenantMiddleware)
# ---------------------------------------------------------------------------


async def _get_company_id(db: AsyncSession) -> str:
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    return result.scalar()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/health")
async def health():
    return {"module": "properties", "status": "ok"}


@router.post("/search/radius", summary="Recherche géospatiale par rayon")
async def search_radius(
    body: RadiusSearchQuery,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Recherche les biens dans un rayon donné (mètres) autour d'un point GPS.
    Retourne les résultats triés par distance croissante, avec dist_m.
    Loi 2 — PostGIS ST_DWithin + ST_Distance sur ::geography.
    """
    company_id = await _get_company_id(db)
    results = await service.search_by_radius(
        db,
        company_id,
        lat=body.latitude,
        lng=body.longitude,
        radius_m=body.radius_m,
        type_=body.type,
        min_price=body.min_price,
        max_price=body.max_price,
        bedrooms=body.bedrooms,
        limit=body.limit,
    )
    return {
        "success": True,
        "data": results,
        "meta": {"count": len(results), "radius_m": body.radius_m},
    }


@router.get("/", response_model=PropertyListOut, summary="Liste des biens")
async def list_properties(
    page: int = Query(1, ge=1, description="Numéro de page"),
    limit: int = Query(20, ge=1, le=100, description="Éléments par page"),
    status: str | None = Query(None, description="Filtre statut"),
    type: str | None = Query(None, description="Filtre type de bien"),
    min_price: Decimal | None = Query(None, ge=0, description="Prix minimum AED"),
    max_price: Decimal | None = Query(None, ge=0, description="Prix maximum AED"),
    bedrooms: int | None = Query(None, ge=0, description="Nombre de chambres"),
    city: str | None = Query(None, description="Ville (recherche partielle)"),
    q: str | None = Query(None, description="Recherche texte libre"),
    db: AsyncSession = Depends(get_db_session),
):
    """Liste paginée des biens immobiliers du tenant, avec filtres optionnels."""
    company_id = await _get_company_id(db)
    items, total = await service.list_properties(
        db,
        company_id,
        page=page,
        limit=limit,
        status=status,
        type_=type,
        min_price=min_price,
        max_price=max_price,
        bedrooms=bedrooms,
        city=city,
        q=q,
    )
    pages = (total + limit - 1) // limit
    return PropertyListOut(
        data=items,
        meta={"total": total, "page": page, "limit": limit, "pages": pages},
    )


@router.post(
    "/",
    response_model=PropertyDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un bien",
)
async def create_property(
    body: PropertyCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager", "agent")),
):
    """
    Crée un nouveau bien immobilier.
    Génère automatiquement la référence DXB-YYYY-NNNN.
    Rôles autorisés : admin, manager, agent.
    """
    company_id = await _get_company_id(db)
    prop = await service.create_property(db, company_id, body)
    return PropertyDetailOut(data=prop)


_IMPORT_MAX_BYTES = 5 * 1024 * 1024  # 5 Mo


@router.post("/import.csv", summary="Import CSV en masse de biens")
async def import_properties_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager")),
) -> dict[str, object]:
    """Import CSV en masse de biens (Loi 1 : chaque bien créé sous le
    `company_id` du tenant). En-têtes = champs `PropertyCreate` ; les colonnes
    `latitude`/`longitude` géolocalisent le bien (PostGIS). Validation Pydantic
    ligne par ligne ; les lignes invalides n'interrompent pas l'import. Renvoie
    un rapport créés/échecs/erreurs."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="empty_file")
    if len(raw) > _IMPORT_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="file_too_large"
        )
    try:
        content = raw.decode("utf-8-sig")  # tolère le BOM Excel
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid_encoding"
        ) from None

    company_id = await _get_company_id(db)
    valid, errors = service.parse_property_rows(content)
    created = 0
    for payload in valid:
        await service.create_property(db, company_id, payload)
        created += 1
    return {
        "success": True,
        "data": {
            "created": created,
            "failed": len(errors),
            "total": created + len(errors),
            "errors": errors[:100],
        },
    }


@router.get(
    "/{property_id}",
    response_model=PropertyDetailOut,
    summary="Détail d'un bien",
)
async def get_property(
    property_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """Retourne le détail d'un bien par son UUID."""
    company_id = await _get_company_id(db)
    prop = await service.get_property(db, company_id, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="property_not_found")
    return PropertyDetailOut(data=prop)


@router.patch(
    "/{property_id}",
    response_model=PropertyDetailOut,
    summary="Mettre à jour un bien",
)
async def update_property(
    property_id: uuid.UUID,
    body: PropertyUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager", "agent")),
):
    """
    Met à jour partiellement un bien existant (PATCH sémantique).
    Rôles autorisés : admin, manager, agent.
    """
    company_id = await _get_company_id(db)
    prop = await service.update_property(db, company_id, property_id, body)
    if not prop:
        raise HTTPException(status_code=404, detail="property_not_found")
    return PropertyDetailOut(data=prop)


@router.delete(
    "/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un bien (soft delete)",
)
async def delete_property(
    property_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager")),
):
    """
    Soft delete — positionne deleted_at, ne supprime jamais physiquement.
    Rôles autorisés : admin, manager.
    """
    company_id = await _get_company_id(db)
    deleted = await service.delete_property(db, company_id, property_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="property_not_found")
