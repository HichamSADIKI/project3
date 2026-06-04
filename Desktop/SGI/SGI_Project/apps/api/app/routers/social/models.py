"""Modèle SQLAlchemy — social_posts (publication réseaux sociaux d'une annonce)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class SocialPost(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Publication d'une annonce sur un canal social. Lien polymorphe."""

    __tablename__ = "social_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Lien polymorphe vers l'annonce (pas de FK cross-table — cf. documents).
    listing_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'sale' | 'rent'
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="published")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
