"""Espace Partenaire (role=partner) — submissions, leads, commissions, services."""
import uuid
from datetime import UTC, date, datetime

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.deps import get_db_session
from app.core.gemini import extract_trade_licence
from app.core.route_deps import require_roles
from app.models.party_vendor import Vendor
from app.routers.partner.schemas import (
    CommissionOut,
    FournisseurProfileOut,
    MessageCreate,
    MessageOut,
    MissionOut,
    MissionStatusUpdate,
    PartnerDashboardOut,
    PartnerLeadCreate,
    PartnerLeadOut,
    PartnerServiceCreate,
    PartnerServiceOut,
    PartnerServiceUpdate,
    PropertySubmissionCreate,
    PropertySubmissionOut,
    VendorDocumentOut,
    VendorProfileOut,
)
from app.routers.partner.service import (
    compute_dashboard,
    create_document,
    create_lead,
    create_service,
    create_submission,
    days_until_expiry,
    document_status,
    get_account_user,
    get_mission,
    get_my_vendor_profile,
    is_valid_mission_transition,
    list_my_commissions,
    list_my_documents,
    list_my_leads,
    list_my_messages,
    list_my_missions,
    list_my_services,
    list_my_submissions,
    resolve_agency_recipient,
    send_message_to_agency,
    set_mission_status,
    update_service,
)

# Documents KYC : ≤ 8 Mo, PDF ou image.
MAX_DOC_BYTES = 8 * 1024 * 1024
_DOC_TYPES = ("trade_licence", "insurance", "vat", "id", "other")

router = APIRouter(
    prefix="/fournisseur",
    tags=["fournisseur"],
    dependencies=[Depends(require_roles("fournisseur"))],
)


def _ctx(request: Request) -> tuple[uuid.UUID, uuid.UUID, str]:
    user_id = getattr(request.state, "user_id", None)
    company_id = getattr(request.state, "company_id", None)
    email = getattr(request.state, "email", None)
    if not user_id or not company_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="not_authenticated"
        )
    return uuid.UUID(user_id), uuid.UUID(company_id), email or ""


# ── Dashboard ────────────────────────────────────────────────────────────
@router.get("/dashboard", response_model=PartnerDashboardOut)
async def get_dashboard(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> PartnerDashboardOut:
    user_id, company_id, email = _ctx(request)
    data = await compute_dashboard(
        db, partner_user_id=user_id, partner_email=email, company_id=company_id
    )
    return PartnerDashboardOut(**data)


# ── Profil fournisseur ─────────────────────────────────────────────────────
@router.get("/profile", response_model=FournisseurProfileOut)
async def get_profile(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> FournisseurProfileOut:
    """Profil du fournisseur connecté : infos compte + profil prestataire
    (catégorie, licence commerciale, statut de validation, notation)."""
    user_id, company_id, email = _ctx(request)
    user = await get_account_user(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="account_not_found"
        )

    vendor = await get_my_vendor_profile(db, user_id, company_id)
    profile: VendorProfileOut | None = None
    if vendor is not None:
        license_url = None
        if vendor.commercial_license_path:
            license_url = await storage.presigned_url(vendor.commercial_license_path)
        profile = VendorProfileOut(
            party_id=vendor.party_id,
            vendor_type=vendor.vendor_type,
            verification_status=vendor.verification_status,
            specialities=vendor.specialities or [],
            service_areas=vendor.service_areas or [],
            trade_licence_number=vendor.trade_licence_number,
            trade_licence_expiry=vendor.trade_licence_expiry,
            trade_licence_authority=vendor.trade_licence_authority,
            insurance_policy_number=vendor.insurance_policy_number,
            insurance_expiry=vendor.insurance_expiry,
            rating_avg=vendor.rating_avg,
            rating_count=vendor.rating_count,
            emergency_24_7=vendor.emergency_24_7,
            is_active=vendor.is_active,
            commercial_license_url=license_url,
            commercial_license_extracted=vendor.commercial_license_extracted or {},
            rejection_reason=vendor.rejection_reason,
            verified_at=vendor.verified_at,
        )

    return FournisseurProfileOut(
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        profile=profile,
    )


# ── Submissions ──────────────────────────────────────────────────────────
@router.get("/submissions", response_model=list[PropertySubmissionOut])
async def list_submissions(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[PropertySubmissionOut]:
    user_id, company_id, _ = _ctx(request)
    items = await list_my_submissions(db, user_id, company_id)
    return [PropertySubmissionOut.model_validate(i) for i in items]


@router.post(
    "/submissions",
    response_model=PropertySubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_submission(
    body: PropertySubmissionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> PropertySubmissionOut:
    user_id, company_id, _ = _ctx(request)
    sub = await create_submission(
        db,
        partner_user_id=user_id,
        company_id=company_id,
        data=body.model_dump(),
    )
    await db.commit()
    return PropertySubmissionOut.model_validate(sub)


# ── Leads ────────────────────────────────────────────────────────────────
@router.get("/leads", response_model=list[PartnerLeadOut])
async def list_leads(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[PartnerLeadOut]:
    user_id, company_id, _ = _ctx(request)
    leads = await list_my_leads(db, user_id, company_id)
    return [PartnerLeadOut.model_validate(le) for le in leads]


@router.post(
    "/leads", response_model=PartnerLeadOut, status_code=status.HTTP_201_CREATED
)
async def post_lead(
    body: PartnerLeadCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> PartnerLeadOut:
    user_id, company_id, _ = _ctx(request)
    data = body.model_dump()
    # email arrive comme EmailStr-str ; FastAPI le sérialise déjà → on le passe brut
    lead = await create_lead(
        db, partner_user_id=user_id, company_id=company_id, data=data
    )
    await db.commit()
    return PartnerLeadOut.model_validate(lead)


# ── Commissions ──────────────────────────────────────────────────────────
@router.get("/commissions", response_model=list[CommissionOut])
async def list_commissions(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[CommissionOut]:
    user_id, company_id, _ = _ctx(request)
    items = await list_my_commissions(db, user_id, company_id)
    return [CommissionOut.model_validate(i) for i in items]


# ── Services ─────────────────────────────────────────────────────────────
@router.get("/services", response_model=list[PartnerServiceOut])
async def list_services(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[PartnerServiceOut]:
    user_id, company_id, _ = _ctx(request)
    items = await list_my_services(db, user_id, company_id)
    return [PartnerServiceOut.model_validate(i) for i in items]


@router.post(
    "/services",
    response_model=PartnerServiceOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_service(
    body: PartnerServiceCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> PartnerServiceOut:
    user_id, company_id, _ = _ctx(request)
    svc = await create_service(
        db, partner_user_id=user_id, company_id=company_id, data=body.model_dump()
    )
    await db.commit()
    return PartnerServiceOut.model_validate(svc)


@router.patch("/services/{service_id}", response_model=PartnerServiceOut)
async def patch_service(
    service_id: uuid.UUID,
    body: PartnerServiceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> PartnerServiceOut:
    user_id, _, _ = _ctx(request)
    svc = await update_service(
        db,
        partner_user_id=user_id,
        service_id=service_id,
        updates=body.model_dump(exclude_unset=True),
    )
    if not svc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="service_not_found"
        )
    await db.commit()
    return PartnerServiceOut.model_validate(svc)


async def _require_vendor(
    db: AsyncSession, user_id: uuid.UUID, company_id: uuid.UUID
) -> Vendor:
    """Profil prestataire du fournisseur courant, ou 404 s'il n'en a pas."""
    vendor = await get_my_vendor_profile(db, user_id, company_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="vendor_profile_not_found"
        )
    return vendor


# ── Documents KYC ───────────────────────────────────────────────────────────
@router.get("/documents", response_model=list[VendorDocumentOut])
async def list_documents(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[VendorDocumentOut]:
    user_id, company_id, _ = _ctx(request)
    vendor = await _require_vendor(db, user_id, company_id)
    docs = await list_my_documents(db, vendor.party_id, company_id)
    today = datetime.now(UTC).date()
    out: list[VendorDocumentOut] = []
    for d in docs:
        url = await storage.presigned_url(d.file_path) if d.file_path else None
        out.append(
            VendorDocumentOut(
                id=d.id,
                doc_type=d.doc_type,
                original_filename=d.original_filename,
                expiry_date=d.expiry_date,
                status=document_status(d.expiry_date, today),
                days_until_expiry=days_until_expiry(d.expiry_date, today),
                url=url,
                extracted=d.extracted or {},
                created_at=d.created_at,
            )
        )
    return out


@router.post(
    "/documents", response_model=VendorDocumentOut, status_code=status.HTTP_201_CREATED
)
async def upload_document(
    request: Request,
    doc_type: str = Form(...),
    expiry_date: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
) -> VendorDocumentOut:
    user_id, company_id, _ = _ctx(request)
    vendor = await _require_vendor(db, user_id, company_id)

    if doc_type not in _DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid_doc_type"
        )
    content_type = file.content_type or ""
    if storage.extension_for_mime(content_type) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="unsupported_document_type",
        )
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="empty_file"
        )
    if len(data) > MAX_DOC_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="file_too_large"
        )

    parsed_expiry: date | None = None
    if expiry_date:
        try:
            parsed_expiry = date.fromisoformat(expiry_date.strip()[:10])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="invalid_expiry_date",
            ) from None

    file_path: str | None = None
    try:
        key = storage.build_fournisseur_license_key(company_id, user_id, content_type)
        file_path = await storage.upload_bytes(key, data, content_type)
    except storage.StorageError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="storage_unavailable"
        ) from None

    # OCR best-effort pour une licence commerciale (pré-remplit l'expiration).
    extracted: dict = {}
    if doc_type == "trade_licence":
        extracted = await extract_trade_licence(data, content_type)
        if parsed_expiry is None:
            iso = extracted.get("trade_licence_expiry")
            if isinstance(iso, str):
                try:
                    parsed_expiry = date.fromisoformat(iso.strip()[:10])
                except ValueError:
                    parsed_expiry = None

    doc = await create_document(
        db,
        vendor_party_id=vendor.party_id,
        company_id=company_id,
        doc_type=doc_type,
        file_path=file_path,
        original_filename=file.filename,
        expiry_date=parsed_expiry,
        extracted=extracted,
    )
    url = await storage.presigned_url(doc.file_path)
    today = datetime.now(UTC).date()
    return VendorDocumentOut(
        id=doc.id,
        doc_type=doc.doc_type,
        original_filename=doc.original_filename,
        expiry_date=doc.expiry_date,
        status=document_status(doc.expiry_date, today),
        days_until_expiry=days_until_expiry(doc.expiry_date, today),
        url=url,
        extracted=doc.extracted or {},
        created_at=doc.created_at,
    )


# ── Missions / interventions ────────────────────────────────────────────────
@router.get("/missions", response_model=list[MissionOut])
async def list_missions(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[MissionOut]:
    user_id, company_id, _ = _ctx(request)
    vendor = await _require_vendor(db, user_id, company_id)
    items = await list_my_missions(db, vendor.party_id, company_id)
    return [MissionOut.model_validate(m) for m in items]


@router.post("/missions/{mission_id}/status", response_model=MissionOut)
async def update_mission_status(
    mission_id: uuid.UUID,
    body: MissionStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MissionOut:
    user_id, company_id, _ = _ctx(request)
    vendor = await _require_vendor(db, user_id, company_id)
    mission = await get_mission(db, mission_id, vendor.party_id, company_id)
    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="mission_not_found"
        )
    if not is_valid_mission_transition(mission.status, body.status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="invalid_status_transition"
        )
    mission = await set_mission_status(db, mission, body.status)
    return MissionOut.model_validate(mission)


# ── Messagerie agence ───────────────────────────────────────────────────────
@router.get("/messages", response_model=list[MessageOut])
async def list_messages(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[MessageOut]:
    user_id, company_id, _ = _ctx(request)
    msgs = await list_my_messages(db, user_id, company_id)
    out: list[MessageOut] = []
    for m in msgs:
        item = MessageOut.model_validate(m)
        item.outgoing = m.sender_user_id == user_id
        out.append(item)
    return out


@router.post(
    "/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED
)
async def post_message(
    body: MessageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MessageOut:
    user_id, company_id, _ = _ctx(request)
    recipient = await resolve_agency_recipient(db, company_id)
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="no_agency_recipient"
        )
    msg = await send_message_to_agency(
        db,
        sender_user_id=user_id,
        recipient_user_id=recipient,
        company_id=company_id,
        subject=body.subject,
        body=body.body,
    )
    item = MessageOut.model_validate(msg)
    item.outgoing = True
    return item


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "fournisseur", "status": "ok"}
