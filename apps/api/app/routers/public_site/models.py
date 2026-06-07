"""Modèles SQLAlchemy propres au module vitrine publique.

`PublicSiteDesign` : réglage (une ligne par société) du design appliqué au
portail public. Loi 1 — `company_id` + RLS (migration 0061).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class PublicSiteDesign(Base, TimestampMixin, TenantMixin):
    __tablename__ = "public_site_design"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 'manual' (style fixe) | 'auto' (rotation temporisée)
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    # style actif en mode manuel : instagram | snapchat | facebook
    style: Mapped[str] = mapped_column(String(32), nullable=False, default="instagram")
    # période de rotation (heures) en mode auto
    delay_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    # ancre temporelle de la rotation (style actif dérivé du temps écoulé)
    rotation_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
