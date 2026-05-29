import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password, verify_password
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus


class AuthError(Exception):
    """Erreur d'authentification typée (utilisée pour distinguer les motifs)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


async def authenticate(
    db: AsyncSession,
    email: str,
    password: str,
    *,
    company_slug: str | None = None,
) -> User:
    """Authentifie un utilisateur.

    Lève `AuthError` avec un code parlant :
    - `invalid_credentials` : email inconnu ou mot de passe faux ou compte non-actif
    - `company_required`    : compte fournisseur sans `company_slug` fourni
    - `company_mismatch`    : `company_slug` ne correspond pas au tenant de l'utilisateur
    """
    result = await db.execute(
        select(User).where(
            User.email == email,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise AuthError("invalid_credentials")
    if user.status != UserStatus.ACTIVE.value:
        raise AuthError("invalid_credentials")

    # Les fournisseurs doivent toujours fournir leur code société.
    if user.role == UserRole.PARTNER.value and not company_slug:
        raise AuthError("company_required")

    # Si un slug est fourni, il doit correspondre à la société de l'utilisateur.
    if company_slug:
        company = await get_company_by_slug(db, company_slug)
        if not company or company.id != user.company_id:
            raise AuthError("company_mismatch")

    return user


async def get_company_by_slug(db: AsyncSession, slug: str) -> Company | None:
    result = await db.execute(
        select(Company).where(
            Company.slug == slug,
            Company.deleted_at.is_(None),
            Company.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def email_exists(db: AsyncSession, email: str) -> bool:
    result = await db.execute(
        select(User.id).where(User.email == email, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none() is not None


async def create_pending_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    full_name: str,
    company_id: uuid.UUID,
    role: UserRole,
    preferred_language: str = "en",
) -> User:
    """Crée un compte Client/Partenaire en statut `pending` (attend validation admin)."""
    user = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role.value,
        status=UserStatus.PENDING.value,
        is_active=True,
        preferred_language=preferred_language,
    )
    db.add(user)
    await db.flush()
    return user
