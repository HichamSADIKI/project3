"""Router FastAPI — Clients."""

import csv
import io
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.clients.schemas import (
    ClientCreate,
    ClientDetailOut,
    ClientListOut,
    ClientOut,
    ClientsSegmentationOut,
    ClientUpdate,
)
from app.routers.clients.service import (
    clients_segmentation,
    create_client,
    delete_client,
    get_client,
    list_clients,
    parse_client_rows,
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


# ⚠️ Doit être déclaré AVANT `/{client_id}` (sinon "export.csv" est parsé en UUID → 422).
_EXPORT_COLUMNS = (
    "id",
    "type",
    "first_name",
    "last_name",
    "company_name",
    "email",
    "phone",
    "phone2",
    "nationality",
    "country_of_residence",
    "source",
    "budget_min",
    "budget_max",
    "preferred_property_type",
    "preferred_location",
)
_EXPORT_MAX = 10000

# Caractères qui déclenchent une formule à l'ouverture du CSV dans un tableur.
_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(value: object) -> str:
    """Neutralise l'injection de formule CSV (OWASP) : préfixe d'une apostrophe les
    cellules commençant par =/+/-/@/TAB/CR (champs contrôlés par l'utilisateur :
    noms, notes…). Empêche l'exécution dans Excel/Sheets."""
    s = "" if value is None else str(value)
    return "'" + s if s[:1] in _CSV_FORMULA_PREFIXES else s


@router.get(
    "/export.csv",
    dependencies=[Depends(_require_roles("admin", "manager"))],
)
async def export_clients_csv(
    request: Request,
    type: str | None = Query(None, alias="type", pattern="^(individual|company)$"),
    q: str | None = Query(None, description="Recherche fulltext"),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export CSV des clients du tenant (Loi 1 : scoping `company_id` via le service).

    Synchrone (stdlib `csv`) : convient au volume courant (plafonné à `_EXPORT_MAX`).
    Au-delà, basculer sur un export asynchrone (tâche `export_clients_xlsx`, stub).
    """
    company_id = _get_company_id(request)
    clients, _ = await list_clients(db, company_id, 1, _EXPORT_MAX, type, q)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_EXPORT_COLUMNS)
    for c in clients:
        writer.writerow([_csv_safe(getattr(c, col, "")) for col in _EXPORT_COLUMNS])

    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="clients.csv"'},
    )


# ⚠️ Doit aussi être déclaré AVANT `/{client_id}` (sinon "import.csv" → UUID 422).
_IMPORT_MAX_BYTES = 5 * 1024 * 1024  # 5 Mo


@router.post(
    "/import.csv",
    dependencies=[Depends(_require_roles("admin", "manager"))],
)
async def import_clients_csv(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    """Import CSV en masse de clients (Loi 1 : chaque ligne créée sous le
    `company_id` du tenant). En-têtes = champs `ClientCreate`. Renvoie un rapport
    par ligne : créés, échecs, erreurs. Validation Pydantic ligne par ligne ;
    les lignes invalides n'interrompent pas l'import."""
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

    company_id = _get_company_id(request)
    valid, errors = parse_client_rows(content)
    created = 0
    for payload in valid:
        await create_client(db, company_id, payload)
        created += 1
    return {
        "success": True,
        "data": {
            "created": created,
            "failed": len(errors),
            "total": created + len(errors),
            "errors": errors[:100],  # rapport borné
        },
    }


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


@router.get("/segmentation", response_model=ClientsSegmentationOut)
async def clients_segmentation_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ClientsSegmentationOut:
    """Segmentation du portefeuille clients : répartition par type et par source,
    et nombre de clients au budget éligible Golden Visa (≥ 2 000 000 AED)."""
    company_id = _get_company_id(request)
    summary = await clients_segmentation(db, company_id)
    return ClientsSegmentationOut(data=summary, meta={})


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
