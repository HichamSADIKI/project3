import enum
import uuid

from sqlalchemy import Boolean, CheckConstraint, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class UserRole(str, enum.Enum):  # noqa: UP042  (str, Enum) volontaire : str(role) ≠ valeur en StrEnum
    """Rôles utilisateur SGI. Stockés comme VARCHAR + CHECK constraint."""

    ADMIN = "admin"
    MANAGER = "manager"
    AGENT = "agent"
    CLIENT = "client"
    PARTNER = "fournisseur"


class UserStatus(str, enum.Enum):  # noqa: UP042  idem UserRole
    """Statut du compte. `pending` pour inscriptions publiques en attente."""

    ACTIVE = "active"
    PENDING = "pending"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


_ROLE_VALUES = ", ".join(f"'{r.value}'" for r in UserRole)
_STATUS_VALUES = ", ".join(f"'{s.value}'" for s in UserStatus)


class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(f"role IN ({_ROLE_VALUES})", name="ck_users_role"),
        CheckConstraint(f"status IN ({_STATUS_VALUES})", name="ck_users_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=UserRole.AGENT.value)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=UserStatus.ACTIVE.value, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Super-admin PLATEFORME (cross-tenant) : accès infra-admin (serveurs, réseau,
    # backups). Hors périmètre Loi 1. Défaut false → aucun accès infra sans grant
    # explicite. Vérifié par `require_platform_admin` (lecture DB, pas dans le JWT).
    is_platform_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    preferred_language: Mapped[str] = mapped_column(
        String(2), nullable=False, default="en", server_default="en"
    )
    # MFA TOTP — secret chiffré (Fernet). NULL = MFA non activé.
    mfa_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Profil public agent (vitrine) — tous nullables (migration 0039).
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(40), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
