import uuid
from datetime import datetime, timezone

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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.auth import encode_jwt
from app.core.config import settings
from app.core.database import get_db
from app.core.gemini import VENDOR_TYPES, extract_trade_licence
from app.core.route_deps import require_roles
from app.models.party_vendor import Vendor
from app.models.user import User, UserRole, UserStatus
from app.routers.auth.schemas import (
    ApproveUserRequest,
    FournisseurRegisterResponse,
    LoginRequest,
    PendingFournisseurItem,
    PendingUserItem,
    PublicRegisterRequest,
    RegisterResponse,
    SocialLoginRequest,
    TokenResponse,
    UserMe,
)
from app.routers.auth.service import (
    AuthError,
    authenticate,
    create_fournisseur_with_profile,
    create_pending_user,
    email_exists,
    get_company_by_slug,
)
from app.routers.client_portal.service import ensure_linked_client_id

router = APIRouter(prefix="/auth", tags=["auth"])

# Licence commerciale : ≤ 8 Mo, PDF ou image scannée.
MAX_LICENSE_BYTES = 8 * 1024 * 1024


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        user = await authenticate(
            db, body.email, body.password, company_slug=body.company_slug
        )
    except AuthError as exc:
        # 422 : validation tenant (le client peut corriger le company_slug).
        # 403 : compte connu mais non-actif (pending/rejected/suspended) —
        #       mot de passe correct, on indique le motif réel.
        # 401 : credentials génériques (email inconnu ou mauvais mot de passe).
        code = exc.code
        if code in ("company_required", "company_mismatch"):
            http_status = status.HTTP_422_UNPROCESSABLE_ENTITY
        elif code.startswith("account_"):
            http_status = status.HTTP_403_FORBIDDEN
        else:
            http_status = status.HTTP_401_UNAUTHORIZED
        raise HTTPException(
            status_code=http_status,
            detail=code,
            headers={"WWW-Authenticate": "Bearer"} if http_status == 401 else None,
        ) from exc

    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
            "language": user.preferred_language,
        }
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_ACCESS_EXPIRE_HOURS * 3600,
    )


@router.get("/me", response_model=UserMe)
async def me(request: Request, db: AsyncSession = Depends(get_db)) -> UserMe:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not_authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    return UserMe.model_validate(user)


async def _public_register(
    db: AsyncSession, body: PublicRegisterRequest, role: UserRole
) -> RegisterResponse:
    """Logique partagée register-client / register-partner."""
    company = await get_company_by_slug(db, body.company_slug)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="company_not_found"
        )
    if await email_exists(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email_already_registered"
        )

    # Les clients sont actifs immédiatement (connexion directe après
    # inscription). Les fournisseurs restent `pending` : leur rattachement à
    # une société exige une validation admin.
    new_status = UserStatus.ACTIVE if role == UserRole.CLIENT else UserStatus.PENDING

    user = await create_pending_user(
        db,
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        company_id=company.id,
        role=role,
        preferred_language=body.preferred_language,
        status=new_status,
    )

    # Pour un client (role=client), créer immédiatement la fiche Client CRM
    # liée à ce User (par email). Le back-office voit ainsi le profil dès
    # l'inscription. Idempotent : si une fiche client existe déjà avec cet
    # email pour ce tenant (prospect existant), on la lie sans dupliquer.
    if role == UserRole.CLIENT:
        await ensure_linked_client_id(
            db,
            user_id=user.id,
            user_email=user.email,
            company_id=company.id,
            client_type=body.client_type,
            trn=body.trn,
            address=body.address,
        )

    await db.commit()
    return RegisterResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        message=(
            "registration_active"
            if user.status == UserStatus.ACTIVE.value
            else "registration_pending_admin_validation"
        ),
    )


@router.post(
    "/register/client",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_client(
    body: PublicRegisterRequest, db: AsyncSession = Depends(get_db)
) -> RegisterResponse:
    """Inscription publique d'un client (acheteur/locataire). Statut `pending`."""
    return await _public_register(db, body, UserRole.CLIENT)


@router.post(
    "/register/fournisseur",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_fournisseur(
    body: PublicRegisterRequest, db: AsyncSession = Depends(get_db)
) -> RegisterResponse:
    """Inscription publique d'un fournisseur (propriétaire/apporteur/prestataire). Statut `pending`."""
    return await _public_register(db, body, UserRole.PARTNER)


@router.post(
    "/register/fournisseur-profile",
    response_model=FournisseurRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_fournisseur_profile(
    email: str = Form(...),
    password: str = Form(..., min_length=8, max_length=128),
    full_name: str = Form(..., min_length=2, max_length=255),
    company_slug: str = Form(..., min_length=2, max_length=100),
    vendor_type: str = Form(...),
    preferred_language: str = Form("en", pattern="^(ar|en|fr)$"),
    commercial_license: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> FournisseurRegisterResponse:
    """Inscription fournisseur **prestataire** unifiée (compte + profil + licence).

    Crée en une fois : le compte de connexion (`pending`), la fiche party Client
    et le profil Vendor (`verification_status=pending`) avec la catégorie choisie.
    La licence commerciale est uploadée sur MinIO et soumise à une extraction
    OCR/IA best-effort (n° licence, expiration, autorité) qui pré-remplit la
    fiche pour faciliter la validation admin.
    """
    if vendor_type not in VENDOR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid_vendor_type",
        )

    content_type = commercial_license.content_type or ""
    if storage.extension_for_mime(content_type) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="unsupported_license_type",
        )

    data = await commercial_license.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="empty_license_file",
        )
    if len(data) > MAX_LICENSE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="license_too_large",
        )

    company = await get_company_by_slug(db, company_slug)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="company_not_found"
        )
    if await email_exists(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email_already_registered"
        )

    # Upload licence (best-effort : un échec MinIO ne bloque pas l'inscription —
    # l'admin pourra redemander le document depuis le back-office).
    license_path: str | None = None
    user_id_for_key = uuid.uuid4()
    try:
        object_key = storage.build_fournisseur_license_key(
            company.id, user_id_for_key, content_type
        )
        license_path = await storage.upload_bytes(object_key, data, content_type)
    except storage.StorageError:
        license_path = None

    # Extraction OCR/IA best-effort (ne lève jamais).
    extracted = await extract_trade_licence(data, content_type)

    user, party_id = await create_fournisseur_with_profile(
        db,
        email=email,
        password=password,
        full_name=full_name,
        company_id=company.id,
        vendor_type=vendor_type,
        preferred_language=preferred_language,
        commercial_license_path=license_path,
        commercial_license_extracted=extracted,
    )
    await db.commit()

    return FournisseurRegisterResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        message="registration_pending_admin_validation",
        party_id=party_id,
        vendor_type=vendor_type,
        verification_status="pending",
        license_uploaded=license_path is not None,
        extracted=extracted,
    )


@router.get(
    "/pending-users",
    response_model=list[PendingUserItem],
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def list_pending_users(
    db: AsyncSession = Depends(get_db),
    role_filter: str | None = Query(default=None, pattern="^(client|fournisseur)$"),
) -> list[PendingUserItem]:
    """Liste les inscriptions en attente de validation (vue admin/manager).

    Filtrée par tenant via RLS (TenantMiddleware) — pas besoin de WHERE company_id ici.
    """
    stmt = select(User).where(
        User.status == UserStatus.PENDING.value,
        User.deleted_at.is_(None),
    )
    if role_filter:
        stmt = stmt.where(User.role == role_filter)
    stmt = stmt.order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        PendingUserItem(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            status=u.status,
            created_at=u.created_at.isoformat() if u.created_at else "",
        )
        for u in users
    ]


@router.get(
    "/pending-fournisseurs",
    response_model=list[PendingFournisseurItem],
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def list_pending_fournisseurs(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[PendingFournisseurItem]:
    """Liste les fournisseurs en attente, enrichis de leur profil prestataire
    (catégorie, URL signée de la licence commerciale, champs extraits par OCR).

    Vue dédiée à l'écran de validation fournisseur du back-office. Le profil
    Vendor est joint en LEFT JOIN : un fournisseur inscrit sans licence (ancien
    flux) reste listé avec des champs profil à null.
    """
    company_id = getattr(request.state, "company_id", None)
    stmt = (
        select(User, Vendor)
        .join(Vendor, Vendor.account_user_id == User.id, isouter=True)
        .where(
            User.role == UserRole.PARTNER.value,
            User.status == UserStatus.PENDING.value,
            User.deleted_at.is_(None),
        )
        .order_by(User.created_at.desc())
    )
    if company_id:
        stmt = stmt.where(User.company_id == uuid.UUID(company_id))

    rows = (await db.execute(stmt)).all()
    items: list[PendingFournisseurItem] = []
    for user, vendor in rows:
        license_url = None
        if vendor is not None and vendor.commercial_license_path:
            license_url = await storage.presigned_url(vendor.commercial_license_path)
        items.append(
            PendingFournisseurItem(
                user_id=user.id,
                party_id=vendor.party_id if vendor else None,
                email=user.email,
                full_name=user.full_name,
                status=user.status,
                created_at=user.created_at.isoformat() if user.created_at else "",
                vendor_type=vendor.vendor_type if vendor else None,
                verification_status=vendor.verification_status if vendor else None,
                commercial_license_url=license_url,
                extracted=(vendor.commercial_license_extracted or {}) if vendor else {},
            )
        )
    return items


@router.post(
    "/pending-users/{user_id}/decision",
    response_model=UserMe,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def decide_pending_user(
    user_id: uuid.UUID,
    body: ApproveUserRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserMe:
    """Approuve ou rejette une inscription en attente.

    Si l'utilisateur pilote un profil prestataire (`vendors.account_user_id`),
    la décision active/refuse aussi ce profil en cascade — c'est ce qui rend le
    fournisseur unifié immédiatement exploitable (compte ET fiche) après
    validation.
    """
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.status == UserStatus.PENDING.value,
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="pending_user_not_found"
        )
    user.status = (
        UserStatus.ACTIVE.value if body.approve else UserStatus.REJECTED.value
    )

    # Cascade sur le profil prestataire lié, le cas échéant.
    vendor = (
        await db.execute(
            select(Vendor).where(
                Vendor.account_user_id == user.id,
                Vendor.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if vendor is not None:
        admin_id = getattr(request.state, "user_id", None)
        if body.approve:
            vendor.verification_status = "verified"
            vendor.verified_at = datetime.now(timezone.utc)
            vendor.verified_by_user_id = uuid.UUID(admin_id) if admin_id else None
            vendor.rejection_reason = None
        else:
            vendor.verification_status = "rejected"
            vendor.rejection_reason = body.reason

    await db.commit()
    await db.refresh(user)
    return UserMe.model_validate(user)


@router.post(
    "/social",
    response_model=TokenResponse,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def social_login(body: SocialLoginRequest) -> TokenResponse:
    """Connexion via fournisseur social (Google, Apple, Facebook, Microsoft,
    Instagram, Snapchat, WhatsApp, Telegram).

    NOTE — stub : tant que les credentials OAuth ne sont pas provisionnés côté
    `settings`, l'endpoint répond 501. L'UI mobile a déjà les boutons câblés.

    Implémentation future :
      1. Valider `id_token` auprès du provider (JWKS Google / appleid.apple.com / Graph FB…).
      2. Lookup `User` par `email` issu du provider — créer en `pending` si inconnu.
      3. Émettre un JWT SGI via `encode_jwt(...)`.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"social_login_provider_not_configured:{body.provider}",
    )


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "auth", "status": "ok"}
