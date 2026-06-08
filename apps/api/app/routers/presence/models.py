"""Modèle SQLAlchemy — présence live (`presence_session`).

Une ligne par (société, session navigateur). Mise à jour par heartbeat. La géo
(pays/ville/lat/lng) est résolue localement depuis l'IP (PDPL-safe). Loi 1 :
`company_id` + RLS (migration 0065).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class PresenceSession(Base, TimestampMixin, TenantMixin):
    __tablename__ = "presence_session"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    session_key: Mapped[str] = mapped_column(String(64), nullable=False)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Géolocalisation de l'IP (résolue localement). NULL si non résoluble.
    geo_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    geo_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    geo_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Navigation courante (mode avancé : ventilation par catégorie/sous-cat/page).
    category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    subcategory: Mapped[str | None] = mapped_column(String(60), nullable=True)
    page: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Dernier heartbeat reçu (fenêtre d'activité).
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
