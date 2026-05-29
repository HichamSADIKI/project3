import uuid
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password, verify_password
from app.models.company import Company
from app.models.party_vendor import Vendor
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
    - `invalid_credentials` : email inconnu ou mot de passe faux
    - `account_pending`     : compte correct mais en attente de validation admin
    - `account_rejected`    : inscription refusée par un admin
    - `account_suspended`   : compte suspendu
    - `company_required`    : compte fournisseur sans `company_slug` fourni
    - `company_mismatch`    : `company_slug` ne correspond pas au tenant de l'utilisateur

    Note sécurité : les codes de statut (`account_*`) ne sont révélés qu'APRÈS
    vérification réussie du mot de passe — pas d'énumération de comptes possible
    sans connaître déjà le mot de passe.
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
        # Le mot de passe est correct : on peut donner un motif précis.
        raise AuthError(f"account_{user.status}")

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
    status: UserStatus = UserStatus.PENDING,
) -> User:
    """Crée un compte Client/Partenaire.

    `status` par défaut `pending` (attend validation admin) ; les clients
    s'inscrivent en `active` pour pouvoir se connecter immédiatement.
    """
    user = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role.value,
        status=status.value,
        is_active=True,
        preferred_language=preferred_language,
    )
    db.add(user)
    await db.flush()
    return user


def _parse_iso_date(value: Any) -> date | None:
    """Parse une date ISO (YYYY-MM-DD) issue de l'OCR. None si invalide."""
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        return None


async def create_fournisseur_with_profile(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    full_name: str,
    company_id: uuid.UUID,
    vendor_type: str,
    preferred_language: str = "en",
    commercial_license_path: str | None = None,
    commercial_license_extracted: dict[str, Any] | None = None,
) -> tuple[User, uuid.UUID]:
    """Crée le triplet unifié d'un fournisseur prestataire :

      1. compte de connexion `User` (role=fournisseur, status=pending)
      2. fiche party `Client` (type=company, liée par email — idempotente)
      3. profil prestataire `Vendor` (verification_status=pending) portant la
         catégorie choisie, la licence uploadée et les champs extraits par OCR.

    Le profil Vendor est rattaché au compte via `account_user_id` — c'est ce
    lien qui permet à la validation admin d'activer compte ET profil d'un coup.
    Ne committe pas (laisse l'appelant maîtriser la transaction).
    """
    # Import paresseux : évite tout cycle d'import au chargement du module.
    from app.routers.client_portal.service import ensure_linked_client_id

    user = await create_pending_user(
        db,
        email=email,
        password=password,
        full_name=full_name,
        company_id=company_id,
        role=UserRole.PARTNER,
        preferred_language=preferred_language,
    )

    party_id = await ensure_linked_client_id(
        db,
        user_id=user.id,
        user_email=user.email,
        company_id=company_id,
        client_type="company",
    )

    extracted = commercial_license_extracted or {}
    vendor = Vendor(
        party_id=party_id,
        company_id=company_id,
        vendor_type=vendor_type,
        account_user_id=user.id,
        verification_status="pending",
        commercial_license_path=commercial_license_path,
        commercial_license_extracted=extracted,
        trade_licence_number=extracted.get("trade_licence_number"),
        trade_licence_authority=extracted.get("trade_licence_authority"),
        trade_licence_expiry=_parse_iso_date(extracted.get("trade_licence_expiry")),
    )
    db.add(vendor)
    await db.flush()
    return user, party_id
