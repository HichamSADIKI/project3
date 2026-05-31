import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class RefreshToken(Base, TimestampMixin):
    """Refresh token opaque (rotation one-time-use).

    Le secret en clair n'est **jamais** persisté : seul son `token_hash`
    (SHA-256 hex, 64 car.) est stocké, comme un mot de passe. À chaque usage le
    token est *tourné* (`replaced_by_id` pointe vers son successeur) et révoqué
    (`revoked_at`). Tous les tokens d'une même session partagent un `family_id` :
    si un token déjà tourné/révoqué est rejoué (vol probable), toute la famille
    est révoquée.

    Liée à `users` uniquement (pas de `company_id`) → **exemptée de RLS**, au
    même titre que `users` / `audit_logs` (Loi 1).
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # SHA-256 hex du secret opaque — unique, jamais le clair.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    # Chaîne de rotation : tous les tokens d'une session partagent ce family_id.
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Révoqué (rotation, logout, ou détection de réutilisation). NULL = actif.
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Token émis en remplacement lors de la rotation (self-FK).
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("refresh_tokens.id", ondelete="SET NULL"),
        nullable=True,
    )
