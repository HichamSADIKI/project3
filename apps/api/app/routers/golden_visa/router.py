import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.deps import get_db_session
from app.core.route_deps import require_roles
from app.routers.golden_visa import schemas, service

router = APIRouter(prefix="/golden-visa", tags=["golden_visa"])

# Taille max d'un document Golden Visa (passeport / DLD / GDRFA / assurance / photo).
MAX_GV_DOC_BYTES = 20 * 1024 * 1024  # 20 Mo


@router.get("/", response_model=schemas.GoldenVisaListOut)
async def list_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    client_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
):
    result = await service.list_applications(
        db, page=page, limit=limit, status=status, client_id=client_id
    )
    return {"success": True, **result}


@router.get("/expiring", response_model=schemas.GoldenVisaListOut)
async def expiring_visas(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
):
    apps = await service.get_expiring_visas(db, days=days)
    return {
        "success": True,
        "data": apps,
        "meta": {"total": len(apps), "page": 1, "limit": len(apps) or 1, "pages": 1},
    }


@router.post("/", response_model=schemas.GoldenVisaDetailOut, status_code=201)
async def create_application(
    payload: schemas.GoldenVisaCreate,
    db: AsyncSession = Depends(get_db_session),
):
    app = await service.create_application(db, payload)
    return {"success": True, "data": app}


@router.get("/{app_id}", response_model=schemas.GoldenVisaDetailOut)
async def get_application(app_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    app = await service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
    return {"success": True, "data": app}


def _checklist_payload(app) -> dict:
    """Charge utile de la checklist documentaire (présence + revue par pièce)."""
    missing = service.missing_documents(app)
    return {
        "required": [label for _, label in service.REQUIRED_DOCUMENTS],
        "present": service.present_documents(app),
        "missing": missing,
        "readiness_pct": service.documents_readiness_pct(app),
        "ready": not missing,
        "items": service.document_items(app),
        "all_approved": service.all_documents_approved(app),
    }


@router.get("/{app_id}/documents/checklist", response_model=schemas.DocumentChecklistOut)
async def documents_checklist(app_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    """Complétude des 5 documents obligatoires (passeport · DLD · GDRFA ·
    assurance · photo biométrique) : présents, manquants, % + revue par pièce."""
    app = await service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
    return {"success": True, "data": _checklist_payload(app)}


@router.post(
    "/{app_id}/documents/{doc_type}",
    response_model=schemas.GoldenVisaDocUploadOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def upload_document(
    app_id: uuid.UUID,
    doc_type: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
):
    """Upload d'un des 5 documents obligatoires (``passport`` · ``dld`` ·
    ``gdrfa`` · ``insurance`` · ``biometric``) vers MinIO. Renseigne la colonne
    correspondante et renvoie une URL présignée. Réservé admin/manager/agent.

    L'objet est nommé de façon déterministe par type → un nouvel upload écrase
    l'ancien (pas d'historique de versions, contrairement au module documents)."""
    attr = service.attr_for_doc_type(doc_type)
    if attr is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="unknown_document_type"
        )
    app = await service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")

    content_type = file.content_type or ""
    if not service.doc_mime_allowed(doc_type, content_type):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="unsupported_document_type"
        )
    ext = storage.extension_for_mime(content_type)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="unsupported_document_type"
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="empty_file")
    if len(data) > MAX_GV_DOC_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="file_too_large"
        )

    key = service.build_gv_doc_key(app.company_id, app.id, doc_type, ext)
    try:
        file_path = await storage.upload_bytes(key, data, content_type)
    except storage.StorageError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="storage_unavailable"
        ) from None

    app = await service.set_document(db, app_id, attr, file_path)
    url = await storage.presigned_url(file_path)
    return {"success": True, "data": app, "url": url}


@router.get(
    "/{app_id}/documents/{doc_type}/download",
    response_model=schemas.GoldenVisaDocDownloadOut,
)
async def download_document(
    app_id: uuid.UUID,
    doc_type: str,
    db: AsyncSession = Depends(get_db_session),
):
    """URL présignée (1 h) pour télécharger un document Golden Visa stocké."""
    attr = service.attr_for_doc_type(doc_type)
    if attr is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="unknown_document_type"
        )
    app = await service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
    file_path = getattr(app, attr, None)
    if not file_path:
        raise HTTPException(status_code=404, detail="document_not_found")
    url = await storage.presigned_url(file_path)
    if url is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="storage_unavailable"
        )
    return {"success": True, "url": url}


@router.patch("/{app_id}", response_model=schemas.GoldenVisaDetailOut)
async def update_application(
    app_id: uuid.UUID,
    payload: schemas.GoldenVisaUpdate,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        app = await service.update_application(db, app_id, payload)
    except service.GVTransitionError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err.code) from err
    if not app:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
    return {"success": True, "data": app}


@router.post(
    "/{app_id}/documents/{doc_type}/review",
    response_model=schemas.DocumentChecklistOut,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def review_document(
    app_id: uuid.UUID,
    doc_type: str,
    payload: schemas.DocumentReviewIn,
    db: AsyncSession = Depends(get_db_session),
):
    """Pose le statut de revue d'une pièce (approved/rejected/pending) + note.
    Renvoie la checklist mise à jour (détail par pièce inclus)."""
    if service.attr_for_doc_type(doc_type) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="unknown_document_type"
        )
    if payload.status not in service.DOC_REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid_review_status"
        )
    app = await service.set_document_review(db, app_id, doc_type, payload.status, payload.notes)
    if not app:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
    return {"success": True, "data": _checklist_payload(app)}


@router.delete("/{app_id}", status_code=204)
async def delete_application(app_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    deleted = await service.delete_application(db, app_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Golden Visa application not found")
