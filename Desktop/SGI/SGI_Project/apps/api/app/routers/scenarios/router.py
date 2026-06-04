"""Router FastAPI — Scenarios (générateur de vidéos social media).

Filtré par `company_id` (Loi 1), gardé par rôle (`admin`/`manager`/`agent`).
L'annonce ciblée est validée comme appartenant au tenant courant — anti-BOLA :
404, jamais 403, hors tenant. La génération vidéo/voix est un STUB (MVP) exécuté
de façon synchrone (instantané) ; une tâche Celery existe pour le futur passage à
un vrai fournisseur asynchrone (app/tasks/scenarios.py).
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.leasing.models import RentalListing
from app.routers.sales.models import SaleListing
from app.routers.scenarios import service
from app.routers.scenarios.schemas import (
    AvatarOut,
    ScenarioCreate,
    ScenarioDetailOut,
    ScenarioListOut,
    ScenarioOut,
    UploadOut,
)

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

_ROLES = ("admin", "manager", "agent")
_MAX_UPLOAD = 15 * 1024 * 1024  # 15 Mo / fichier
_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/webm": "webm",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
}


async def _listing_belongs(
    db: AsyncSession, company_id: uuid.UUID, listing_type: str, listing_id: uuid.UUID
) -> bool:
    model = SaleListing if listing_type == "sale" else RentalListing
    row = (
        await db.execute(
            select(model.id).where(
                model.id == listing_id,
                model.company_id == company_id,
                model.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    return row is not None


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "scenarios", "status": "ok"}


@router.get("/avatars", response_model=AvatarOut, dependencies=[Depends(require_roles(*_ROLES))])
async def avatars_endpoint() -> AvatarOut:
    return AvatarOut(
        data=[
            {"key": "male", "label": "Homme", "voice": service.avatar_voice_label("male")},
            {"key": "female", "label": "Femme", "voice": service.avatar_voice_label("female")},
        ]
    )


@router.get("/", response_model=ScenarioListOut, dependencies=[Depends(require_roles(*_ROLES))])
async def list_endpoint(
    listing_type: str | None = Query(None, pattern="^(sale|rent)$"),
    listing_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
) -> ScenarioListOut:
    company_id = await get_company_id(db)
    rows = await service.list_scenarios(
        db, company_id, listing_type=listing_type, listing_id=listing_id
    )
    return ScenarioListOut(data=[ScenarioOut.model_validate(r) for r in rows])


@router.post(
    "/upload",
    response_model=UploadOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*_ROLES))],
)
async def upload_endpoint(
    kind: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
) -> UploadOut:
    company_id = await get_company_id(db)
    if kind not in ("photo", "audio"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_kind")
    content_type = file.content_type or ""
    ext = _EXT.get(content_type)
    if ext is None or (kind == "photo") != content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="unsupported_media_type"
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="empty_file")
    if len(data) > _MAX_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="file_too_large"
        )
    key = f"scenarios/{company_id}/{kind}/{uuid.uuid4().hex}.{ext}"
    try:
        await storage.upload_bytes(key, data, content_type)
    except storage.StorageError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="storage_unavailable"
        ) from None
    url = await storage.presigned_url(key) or ""
    return UploadOut(data={"ref": key, "url": url})


@router.post(
    "/",
    response_model=ScenarioDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*_ROLES))],
)
async def create_endpoint(
    body: ScenarioCreate,
    db: AsyncSession = Depends(get_db_session),
) -> ScenarioDetailOut:
    company_id = await get_company_id(db)
    if not await _listing_belongs(db, company_id, body.listing_type, body.listing_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="listing_not_found")
    scenario = await service.create_scenario(
        db,
        company_id,
        listing_type=body.listing_type,
        listing_id=body.listing_id,
        voice_mode=body.voice_mode,
        photo_refs=body.photo_refs,
        title=body.title,
        avatar=body.avatar,
        script=body.script,
        audio_ref=body.audio_ref,
    )
    # MVP : génération stub instantanée (un vrai fournisseur asynchrone passerait
    # par app.tasks.scenarios.generate.delay(...) et laisserait le statut 'generating').
    done = await service.run_stub_generation(db, company_id, scenario.id)
    return ScenarioDetailOut(data=ScenarioOut.model_validate(done or scenario))


@router.get(
    "/{scenario_id}",
    response_model=ScenarioDetailOut,
    dependencies=[Depends(require_roles(*_ROLES))],
)
async def get_endpoint(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> ScenarioDetailOut:
    company_id = await get_company_id(db)
    scenario = await service.get_scenario(db, company_id, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="scenario_not_found")
    return ScenarioDetailOut(data=ScenarioOut.model_validate(scenario))


@router.post(
    "/{scenario_id}/generate",
    response_model=ScenarioDetailOut,
    dependencies=[Depends(require_roles(*_ROLES))],
)
async def generate_endpoint(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> ScenarioDetailOut:
    company_id = await get_company_id(db)
    scenario = await service.run_stub_generation(db, company_id, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="scenario_not_found")
    return ScenarioDetailOut(data=ScenarioOut.model_validate(scenario))


@router.delete(
    "/{scenario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*_ROLES))],
)
async def delete_endpoint(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await get_company_id(db)
    scenario = await service.soft_delete(db, company_id, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="scenario_not_found")
