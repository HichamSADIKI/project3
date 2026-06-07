"""Modèle SQLAlchemy — honeytokens (leurres de sécurité).

`Honeytoken` : un leurre par ligne, isolé par société (Loi 1 — `company_id` + RLS,
migration 0062). Le `token` est un secret unique à haute entropie : son utilisation
sur l'endpoint *trip* est le signal de déclenchement.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin

# Types de leurre exposés (cohérent avec la CheckConstraint de la migration 0062).
HONEYTOKEN_KINDS: tuple[str, ...] = ("api_key", "url", "secret", "record")


class Honeytoken(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    __tablename__ = "honeytokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Catégorie du leurre : api_key | url | secret | record.
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="api_key")
    # Libellé lisible (où le leurre est planté, pour l'analyste).
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    # Secret unique à haute entropie — jamais loggé en clair (voir service.redact).
    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    # Un leurre désactivé ne déclenche plus d'alerte (conservé pour l'historique).
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Dernière utilisation détectée + compteur cumulé de déclenchements.
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    trigger_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
