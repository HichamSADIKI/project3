"""Router Inspections — /api/v1/inspections."""

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles

from .schemas import (
    InspectionCreate,
    InspectionDetailOut,
    InspectionListOut,
    InspectionOut,
    InspectionUpdate,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    PhotoOut,
    SectionCreate,
    SectionOut,
    SignIn,
    UpcomingInspectionsOut,
)
from .service import (
    add_photo,
    create_inspection,
    create_item,
    create_section,
    get_inspection,
    list_inspections,
    list_items,
    list_photos,
    list_sections,
    soft_delete_inspection,
    transition_inspection,
    upcoming_inspections,
    update_inspection,
    update_item,
)

router = APIRouter(prefix="/inspections", tags=["inspections"])


def _uid(req: Request) -> uuid.UUID:
    uid = getattr(req.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return uuid.UUID(uid)


# ── CRUD Inspections ──────────────────────────────────────────────────────


@router.get("", response_model=InspectionListOut)
async def list_insp(
    unit_id: uuid.UUID | None = Query(None),
    inspection_type: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InspectionListOut:
    cid = await get_company_id(db)
    items, total = await list_inspections(db, cid, unit_id, inspection_type, status, page, limit)
    pages = (total + limit - 1) // limit
    return InspectionListOut(
        data=[InspectionOut.model_validate(i) for i in items],
        meta={"total": total, "page": page, "limit": limit, "pages": pages},
    )


@router.post("", response_model=InspectionDetailOut, status_code=status.HTTP_201_CREATED)
async def create_insp(
    body: InspectionCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InspectionDetailOut:
    cid = await get_company_id(db)
    insp = await create_inspection(db, cid, body)
    return InspectionDetailOut(data=InspectionOut.model_validate(insp))


@router.get("/upcoming", response_model=UpcomingInspectionsOut)
async def upcoming_insp(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> UpcomingInspectionsOut:
    """Planning des inspections actives (scheduled/in_progress) à venir ou en
    retard, dans une fenêtre de `days` jours. Triées par date planifiée."""
    from datetime import UTC, datetime

    cid = await get_company_id(db)
    today = datetime.now(UTC).date()
    entries = await upcoming_inspections(db, cid, today, days)
    return UpcomingInspectionsOut(
        data=entries, meta={"reference_date": str(today), "horizon_days": days}
    )


@router.get("/{insp_id}", response_model=InspectionDetailOut)
async def get_insp(
    insp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InspectionDetailOut:
    cid = await get_company_id(db)
    insp = await get_inspection(db, cid, insp_id)
    if not insp:
        raise HTTPException(status_code=404, detail="inspection_not_found")
    return InspectionDetailOut(data=InspectionOut.model_validate(insp))


@router.patch("/{insp_id}", response_model=InspectionDetailOut)
async def update_insp(
    insp_id: uuid.UUID,
    body: InspectionUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InspectionDetailOut:
    cid = await get_company_id(db)
    insp = await update_inspection(db, cid, insp_id, body)
    if not insp:
        raise HTTPException(status_code=404, detail="inspection_not_found")
    return InspectionDetailOut(data=InspectionOut.model_validate(insp))


@router.delete("/{insp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_insp(
    insp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> None:
    cid = await get_company_id(db)
    if not await soft_delete_inspection(db, cid, insp_id):
        raise HTTPException(status_code=404, detail="inspection_not_found")


# ── Transitions ───────────────────────────────────────────────────────────


@router.post("/{insp_id}/start", response_model=InspectionDetailOut)
async def start_insp(
    insp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InspectionDetailOut:
    cid = await get_company_id(db)
    insp = await transition_inspection(db, cid, insp_id, "in_progress")
    if not insp:
        raise HTTPException(status_code=404, detail="inspection_not_found")
    return InspectionDetailOut(data=InspectionOut.model_validate(insp))


@router.post("/{insp_id}/complete", response_model=InspectionDetailOut)
async def complete_insp(
    insp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InspectionDetailOut:
    cid = await get_company_id(db)
    insp = await transition_inspection(db, cid, insp_id, "completed")
    if not insp:
        raise HTTPException(status_code=404, detail="inspection_not_found")
    return InspectionDetailOut(data=InspectionOut.model_validate(insp))


@router.post("/{insp_id}/sign", response_model=InspectionDetailOut)
async def sign_insp(
    insp_id: uuid.UUID,
    body: SignIn,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InspectionDetailOut:
    cid = await get_company_id(db)
    insp = await transition_inspection(db, cid, insp_id, "signed", signed_by=body.signed_by)
    if not insp:
        raise HTTPException(status_code=404, detail="inspection_not_found")
    return InspectionDetailOut(data=InspectionOut.model_validate(insp))


# ── Sections ──────────────────────────────────────────────────────────────


@router.get("/{insp_id}/sections", response_model=list[SectionOut])
async def list_sects(
    insp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> list[SectionOut]:
    cid = await get_company_id(db)
    return [SectionOut.model_validate(s) for s in await list_sections(db, cid, insp_id)]


@router.post("/{insp_id}/sections", response_model=SectionOut, status_code=status.HTTP_201_CREATED)
async def add_sect(
    insp_id: uuid.UUID,
    body: SectionCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> SectionOut:
    cid = await get_company_id(db)
    sec = await create_section(db, cid, insp_id, body)
    return SectionOut.model_validate(sec)


# ── Items ─────────────────────────────────────────────────────────────────


@router.get("/{insp_id}/sections/{sect_id}/items", response_model=list[ItemOut])
async def list_its(
    insp_id: uuid.UUID,
    sect_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> list[ItemOut]:
    cid = await get_company_id(db)
    return [ItemOut.model_validate(i) for i in await list_items(db, cid, sect_id)]


@router.post(
    "/{insp_id}/sections/{sect_id}/items",
    response_model=ItemOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_item(
    insp_id: uuid.UUID,
    sect_id: uuid.UUID,
    body: ItemCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> ItemOut:
    cid = await get_company_id(db)
    item = await create_item(db, cid, sect_id, body)
    return ItemOut.model_validate(item)


@router.patch("/{insp_id}/sections/{sect_id}/items/{item_id}", response_model=ItemOut)
async def patch_item(
    insp_id: uuid.UUID,
    sect_id: uuid.UUID,
    item_id: uuid.UUID,
    body: ItemUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> ItemOut:
    cid = await get_company_id(db)
    item = await update_item(db, cid, item_id, body)
    if not item:
        raise HTTPException(status_code=404, detail="item_not_found")
    return ItemOut.model_validate(item)


# ── Photos ────────────────────────────────────────────────────────────────


@router.post(
    "/{insp_id}/sections/{sect_id}/items/{item_id}/photo",
    response_model=PhotoOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_photo(
    insp_id: uuid.UUID,
    sect_id: uuid.UUID,
    item_id: uuid.UUID,
    photo: UploadFile = File(...),
    caption: str | None = Form(None),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> PhotoOut:
    from app.core.storage import StorageError, extension_for_mime, is_configured, upload_bytes

    cid = await get_company_id(db)
    content_type = photo.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="unsupported_image_mime")

    data = await photo.read()
    if not data:
        raise HTTPException(status_code=422, detail="empty_file")
    if len(data) > 10 * 1024 * 1024:  # 10 Mo max
        raise HTTPException(status_code=422, detail="image_too_large")

    file_key = f"inspections/{cid}/{insp_id}/{item_id}/{uuid.uuid4()}"
    ext = extension_for_mime(content_type)
    if ext:
        file_key = f"{file_key}.{ext}"

    if is_configured():
        try:
            file_key = await upload_bytes(file_key, data, content_type)
        except StorageError as exc:
            raise HTTPException(status_code=503, detail=f"storage_error: {exc}") from exc

    p = await add_photo(db, cid, item_id, file_key, caption)
    return PhotoOut.model_validate(p)


@router.get("/{insp_id}/sections/{sect_id}/items/{item_id}/photos", response_model=list[PhotoOut])
async def get_photos(
    insp_id: uuid.UUID,
    sect_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> list[PhotoOut]:
    cid = await get_company_id(db)
    return [PhotoOut.model_validate(p) for p in await list_photos(db, cid, item_id)]


# ── Historique par unité ──────────────────────────────────────────────────


@router.get("/unit/{unit_id}", response_model=InspectionListOut)
async def unit_history(
    unit_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InspectionListOut:
    cid = await get_company_id(db)
    items, total = await list_inspections(db, cid, unit_id=unit_id, page=page, limit=limit)
    pages = (total + limit - 1) // limit
    return InspectionListOut(
        data=[InspectionOut.model_validate(i) for i in items],
        meta={"total": total, "page": page, "limit": limit, "pages": pages},
    )
