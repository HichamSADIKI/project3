"""Modèle SQLAlchemy — video_scenarios (générateur vidéo social media)."""

from __future__ import annotations

import uuid

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class VideoScenario(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Scénario vidéo : photos + voix (avatar ou enregistrée) → vidéo social media."""

    __tablename__ = "video_scenarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Lien polymorphe vers l'annonce (pas de FK cross-table — cf. social_posts).
    listing_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'sale' | 'rent'
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    voice_mode: Mapped[str] = mapped_column(String(10), nullable=False, default="avatar")
    avatar: Mapped[str | None] = mapped_column(String(10), nullable=True)  # 'male' | 'female'
    script: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Références objet MinIO (clés) des photos / de l'audio enregistré.
    photo_refs: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    audio_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
