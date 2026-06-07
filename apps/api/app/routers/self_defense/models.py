"""Modèles SQLAlchemy — administration Self-Defense.

- `SelfDefenseConfig` : réglage par société (codes HASHÉS armer/désarmer, nb d'essais
  max, armgate activé, options JSONB extensibles). Une ligne par société.
- `SelfDefenseLockout` : état de verrouillage par utilisateur (compteur d'échecs +
  verrou) — déverrouillable par un admin.

Loi 1 : `company_id` + RLS (migration 0064). Les codes ne sont JAMAIS stockés en
clair — uniquement leur hash bcrypt (cf. service).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class SelfDefenseConfig(Base, TimestampMixin, TenantMixin):
    __tablename__ = "self_defense_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Hash bcrypt des codes (jamais en clair). NULL = code non encore défini.
    arm_code_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    disarm_code_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Nb d'échecs avant verrouillage de l'utilisateur.
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    # Si False, le bouton/menu reste libre (pas de demande de code).
    armgate_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Réglages futurs (extensible) — { clé: valeur }.
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class SelfDefenseLockout(Base, TimestampMixin, TenantMixin):
    __tablename__ = "self_defense_lockout"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
