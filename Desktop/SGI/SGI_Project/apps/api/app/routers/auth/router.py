import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt
from app.core.config import settings
from app.core.database import get_db
from app.core.route_deps import require_roles
from app.models.user import User, UserRole, UserStatus
from app.routers.auth.schemas import (
    ApproveUserRequest,
    LoginRequest,
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
    create_pending_user,
    email_exists,
    get_company_by_slug,
)
from app.routers.client_portal.service import ensure_linked_client_id

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        user = await authenticate(
            db, body.email, body.password, company_slug=body.company_slug
        )
    except AuthError as exc:
        # 422 pour la validation tenant (le client peut corriger) ;
        # 401 sinon (credentials génériques).
        code = exc.code
        http_status = (
            status.HTTP_422_UNPROCESSABLE_ENTITY
            if code in ("company_required", "company_mismatch")
            else status.HTTP_401_UNAUTHORIZED
        )
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

    user = await create_pending_user(
        db,
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        company_id=company.id,
        role=role,
        preferred_language=body.preferred_language,
    )

    # Pour un client (role=client), créer immédiatement la fiche Client CRM
    # liée à ce User (par email). Le back-office voit ainsi le profil dès
    # l'inscription, même en statut `pending`. Idempotent : si une fiche
    # client existe déjà avec cet email pour ce tenant (prospect existant),
    # on la lie sans dupliquer.
    if role == UserRole.CLIENT:
        await ensure_linked_client_id(
            db,
            user_id=user.id,
            user_email=user.email,
            company_id=company.id,
        )

    await db.commit()
    return RegisterResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        message="registration_pending_admin_validation",
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


@router.post(
    "/pending-users/{user_id}/decision",
    response_model=UserMe,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def decide_pending_user(
    user_id: uuid.UUID,
    body: ApproveUserRequest,
    db: AsyncSession = Depends(get_db),
) -> UserMe:
    """Approuve ou rejette une inscription en attente."""
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
