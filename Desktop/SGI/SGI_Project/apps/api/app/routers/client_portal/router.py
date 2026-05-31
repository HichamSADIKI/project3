"""Espace Client (role=client) — favoris, visites, messages, dashboard."""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import require_roles
from app.core.whisper import MAX_AUDIO_BYTES, WhisperUnavailable, transcribe_audio
from app.routers.client_portal.schemas import (
    ClientDashboardOut,
    ClientMeProfileOut,
    ClientMeProfileUpdate,
    FavoriteCreate,
    FavoriteOut,
    MessageCreate,
    MessageOut,
    MyLeadOut,
    NeedSubmitIn,
    NeedSubmitMultiIn,
    NeedSubmitMultiOut,
    NeedSubmitOut,
    ParsedNeedOut,
    TranscribeOut,
    VisitRequestCreate,
    VisitRequestOut,
)
from app.routers.client_portal.service import (
    add_favorite,
    compute_dashboard,
    create_visit_request,
    find_linked_client_id,
    get_my_profile,
    list_my_favorites,
    list_my_leads,
    list_my_messages,
    list_my_visits,
    mark_message_read,
    preview_client_need,
    remove_favorite,
    send_message,
    submit_client_need,
    submit_client_needs,
    update_my_profile,
)

router = APIRouter(
    prefix="/client",
    tags=["client_portal"],
    dependencies=[Depends(require_roles("client"))],
)


def _ctx(request: Request) -> tuple[uuid.UUID, uuid.UUID, str]:
    """Extrait (user_id, company_id, email) du JWT décodé par TenantMiddleware."""
    user_id = getattr(request.state, "user_id", None)
    company_id = getattr(request.state, "company_id", None)
    email = getattr(request.state, "email", None)
    if not user_id or not company_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not_authenticated")
    return uuid.UUID(user_id), uuid.UUID(company_id), email or ""


# ── Dashboard ────────────────────────────────────────────────────────────
@router.get("/dashboard", response_model=ClientDashboardOut)
async def get_dashboard(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> ClientDashboardOut:
    user_id, company_id, email = _ctx(request)
    data = await compute_dashboard(db, user_id=user_id, user_email=email, company_id=company_id)
    return ClientDashboardOut(**data)


# ── Profil « mon profil » (sync portal ↔ back-office CRM) ────────────────
@router.get("/me/profile", response_model=ClientMeProfileOut)
async def get_me_profile(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> ClientMeProfileOut:
    """Profil CRM du client connecté. Crée la fiche à la volée si absente."""
    user_id, company_id, email = _ctx(request)
    client = await get_my_profile(db, user_id=user_id, user_email=email, company_id=company_id)
    await db.commit()
    return ClientMeProfileOut.model_validate(client)


@router.patch("/me/profile", response_model=ClientMeProfileOut)
async def patch_me_profile(
    body: ClientMeProfileUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ClientMeProfileOut:
    """Met à jour les champs whitelistés du profil — la modif est visible
    immédiatement côté back-office via GET /api/v1/clients/{id}."""
    user_id, company_id, email = _ctx(request)
    data = body.model_dump(exclude_unset=True)
    client = await update_my_profile(
        db,
        user_id=user_id,
        user_email=email,
        company_id=company_id,
        data=data,
    )
    await db.commit()
    return ClientMeProfileOut.model_validate(client)


# ── Favoris ──────────────────────────────────────────────────────────────
@router.get("/favorites", response_model=list[FavoriteOut])
async def list_favorites(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[FavoriteOut]:
    user_id, company_id, _ = _ctx(request)
    favs = await list_my_favorites(db, user_id, company_id)
    return [FavoriteOut.model_validate(f) for f in favs]


@router.post("/favorites", response_model=FavoriteOut, status_code=status.HTTP_201_CREATED)
async def post_favorite(
    body: FavoriteCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> FavoriteOut:
    user_id, company_id, _ = _ctx(request)
    try:
        fav = await add_favorite(db, user_id, company_id, body.property_id)
        await db.commit()
        return FavoriteOut.model_validate(fav)
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="already_in_favorites"
        ) from None


@router.delete("/favorites/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_favorite(
    favorite_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db_session)
) -> None:
    user_id, _, _ = _ctx(request)
    ok = await remove_favorite(db, user_id, favorite_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="favorite_not_found")
    await db.commit()


# ── Visites ──────────────────────────────────────────────────────────────
@router.get("/visits", response_model=list[VisitRequestOut])
async def list_visits(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[VisitRequestOut]:
    user_id, company_id, _ = _ctx(request)
    visits = await list_my_visits(db, user_id, company_id)
    return [VisitRequestOut.model_validate(v) for v in visits]


@router.post("/visits", response_model=VisitRequestOut, status_code=status.HTTP_201_CREATED)
async def post_visit(
    body: VisitRequestCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> VisitRequestOut:
    user_id, company_id, _ = _ctx(request)
    visit = await create_visit_request(
        db,
        user_id=user_id,
        company_id=company_id,
        property_id=body.property_id,
        preferred_date=body.preferred_date,
        preferred_time_slot=body.preferred_time_slot,
        client_notes=body.client_notes,
    )
    await db.commit()
    return VisitRequestOut.model_validate(visit)


# ── Mes leads (besoins/deals créés par le client) ────────────────────────
@router.get("/leads", response_model=list[MyLeadOut])
async def list_leads(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[MyLeadOut]:
    """Liste les leads/besoins créés par le client connecté (les plus récents
    en premier). Alimente la page « Mes leads » du portail."""
    _user_id, company_id, email = _ctx(request)
    leads = await list_my_leads(db, user_email=email, company_id=company_id)
    return [MyLeadOut.model_validate(lead) for lead in leads]


# ── Messages ─────────────────────────────────────────────────────────────
@router.get("/messages", response_model=list[MessageOut])
async def list_messages(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> list[MessageOut]:
    user_id, company_id, _ = _ctx(request)
    msgs = await list_my_messages(db, user_id, company_id)
    return [MessageOut.model_validate(m) for m in msgs]


@router.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def post_message(
    body: MessageCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> MessageOut:
    user_id, company_id, _ = _ctx(request)
    msg = await send_message(
        db,
        sender_user_id=user_id,
        company_id=company_id,
        recipient_user_id=body.recipient_user_id,
        subject=body.subject,
        body=body.body,
        related_property_id=body.related_property_id,
        related_contract_id=body.related_contract_id,
    )
    await db.commit()
    return MessageOut.model_validate(msg)


@router.post("/messages/{message_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def post_mark_read(
    message_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db_session)
) -> None:
    user_id, _, _ = _ctx(request)
    ok = await mark_message_read(db, user_id, message_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="message_not_found")
    await db.commit()


# ── Maintenance (tickets du client connecté) ─────────────────────────────
@router.get("/maintenance")
async def list_my_maintenance(request: Request, db: AsyncSession = Depends(get_db_session)):
    """Liste les tickets de maintenance rapportés par le client connecté."""
    from sqlalchemy import select

    from app.models.maintenance import MaintenanceTicket

    _user_id, company_id, email = _ctx(request)
    client_id = await find_linked_client_id(db, email, company_id)
    if not client_id:
        return []

    result = await db.execute(
        select(MaintenanceTicket)
        .where(
            MaintenanceTicket.company_id == company_id,
            MaintenanceTicket.reported_by_user_id == _user_id,
            MaintenanceTicket.deleted_at.is_(None),
        )
        .order_by(MaintenanceTicket.created_at.desc())
    )
    from app.routers.maintenance.schemas import TicketOut

    return [TicketOut.model_validate(t) for t in result.scalars().all()]


# ── Expression de besoin (texte / dictée vocale) ─────────────────────────
@router.post(
    "/needs",
    response_model=NeedSubmitOut,
    status_code=status.HTTP_201_CREATED,
    summary="Soumettre un besoin libre (texte ou dictée) — crée un deal CRM",
)
async def post_need(
    body: NeedSubmitIn,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> NeedSubmitOut:
    """
    Reçoit un besoin client en texte libre (écrit ou transcrit du micro),
    appelle l'IA pour le structurer (catégorie, budget, urgence, localisation),
    et crée automatiquement un CRMLead dans le pipeline du bon secteur.

    - Réservé aux comptes role=client (verrouillé par dependencies du router).
    - Le client doit être lié à un Client CRM (party) via son email — sinon 422.
    - Si la confiance IA < 60%, défaut sur 'realestate' (cœur métier SGI).
    - Le deal apparaît en `status='new'` dans le sector-crm du backoffice.
    """
    user_id, company_id, email = _ctx(request)
    try:
        result = await submit_client_need(
            db,
            user_id=user_id,
            user_email=email,
            company_id=company_id,
            text=body.text,
            locale=body.locale,
            source=body.source,
            category_override=body.category_override,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"need_submission_failed: {exc}",
        ) from exc

    return NeedSubmitOut(
        lead_id=result["lead_id"],
        crm_ref=result["crm_ref"],
        category=result["category"],
        parsed=ParsedNeedOut(**result["parsed"]),
    )


@router.post(
    "/needs/preview",
    response_model=ParsedNeedOut,
    status_code=status.HTTP_200_OK,
    summary="Prévisualiser la catégorie détectée — sans créer de deal",
)
async def post_need_preview(
    body: NeedSubmitIn,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ParsedNeedOut:
    """Analyse le besoin et renvoie la catégorie détectée (+ budget, urgence…)
    SANS rien créer en base.

    Utilisé par le portail pour afficher au client, dans une popup de
    confirmation, la catégorie proposée — qu'il peut valider ou modifier
    avant l'envoi définitif via `POST /needs` (avec `category_override`).
    """
    _ctx(request)  # auth role=client (lève 401 sinon)
    parsed = await preview_client_need(
        body.text, locale=body.locale, category_override=body.category_override
    )
    return ParsedNeedOut(**parsed)


@router.post(
    "/needs/multi",
    response_model=NeedSubmitMultiOut,
    status_code=status.HTTP_201_CREATED,
    summary="Soumettre un besoin sous une ou plusieurs catégories — 1 deal / catégorie",
)
async def post_needs_multi(
    body: NeedSubmitMultiIn,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> NeedSubmitMultiOut:
    """Crée un deal CRM par catégorie validée par le client dans la popup.

    Le besoin (texte) est parsé une seule fois ; chaque catégorie choisie
    produit un deal distinct dans le pipeline du secteur correspondant.
    """
    user_id, company_id, email = _ctx(request)
    try:
        result = await submit_client_needs(
            db,
            user_id=user_id,
            user_email=email,
            company_id=company_id,
            text=body.text,
            locale=body.locale,
            source=body.source,
            categories=body.categories,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"need_submission_failed: {exc}",
        ) from exc

    # pydantic coerce deals (list[dict]) → list[DealRef] et parsed (dict) → ParsedNeedOut
    return NeedSubmitMultiOut(**result)


@router.post(
    "/needs/transcribe",
    response_model=TranscribeOut,
    status_code=status.HTTP_200_OK,
    summary="Transcrire un buffer audio (fallback Whisper pour Safari/iOS)",
)
async def post_transcribe(
    request: Request,
    audio: UploadFile = File(..., description="Buffer audio (≤ 5 MB, WebM/MP4/OGG/WAV)"),
    locale: str = Form(default="fr"),
) -> TranscribeOut:
    """
    Transcrit un buffer audio via OpenAI Whisper.

    Utilisé comme fallback côté portal client quand Web Speech API n'est pas
    supportée (Safari/iOS). Le navigateur enregistre via MediaRecorder, envoie
    ici, on retourne le texte. Le texte est ensuite renvoyé sur `/needs`.

    Erreurs :
    - 503 si OPENAI_API_KEY absente ou Whisper indisponible
    - 413 si audio > 5 MB
    - 422 si MIME non supporté
    """
    if locale not in ("ar", "en", "fr"):
        raise HTTPException(status_code=422, detail="unsupported_locale")

    # Vérifie l'auth via _ctx (lève 401 si pas connecté)
    _ctx(request)

    content_type = audio.content_type or "audio/webm"
    raw = await audio.read()
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio_too_large")
    if len(raw) == 0:
        raise HTTPException(status_code=422, detail="empty_audio")

    try:
        text = await transcribe_audio(
            raw,
            filename=audio.filename or "voice.webm",
            content_type=content_type,
            locale=locale,  # type: ignore[arg-type]
        )
    except WhisperUnavailable as exc:
        detail = str(exc)
        if detail == "audio_too_large":
            raise HTTPException(status_code=413, detail=detail) from exc
        if detail.startswith("unsupported_audio_mime"):
            raise HTTPException(status_code=422, detail=detail) from exc
        # openai_api_key_missing, whisper_unreachable, whisper_http_*, empty
        raise HTTPException(status_code=503, detail=detail) from exc

    return TranscribeOut(text=text, locale=locale)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "client_portal", "status": "ok"}
