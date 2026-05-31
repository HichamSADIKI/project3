import uuid

from geoalchemy2 import Geometry
from sqlalchemy import (
    DECIMAL,
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Property(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """
    Bien immobilier — Loi 2 : localisation stockée en PostGIS GEOMETRY(Point, 4326).
    Index GIST obligatoire (créé en migration Alembic).
    RLS actif via company_id (TenantMixin).
    """

    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Référence interne — unique PAR société (multi-tenant), pas globalement.
    reference: Mapped[str] = mapped_column(String(50), nullable=False)

    # Catégorie du bien
    type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Titres multilingues
    title_ar: Mapped[str | None] = mapped_column(String(300), nullable=True)
    title_en: Mapped[str | None] = mapped_column(String(300), nullable=True)
    title_fr: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Descriptions multilingues
    description_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_fr: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Prix en AED
    price: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)

    # Superficie
    area_sqm: Mapped[float | None] = mapped_column(DECIMAL(10, 2), nullable=True)

    # Caractéristiques
    bedrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bathrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Statut
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="available")

    # Localisation PostGIS — Loi 2
    # Index GIST créé en migration : CREATE INDEX ON properties USING GIST(location)
    location = mapped_column(Geometry("POINT", srid=4326), nullable=True)

    # Adresses multilingues
    address_en: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_ar: Mapped[str | None] = mapped_column(String(300), nullable=True)
    district: Mapped[str | None] = mapped_column(String(150), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, default="Dubai")

    # Informations promoteur / construction
    developer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_floors: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Équipements
    furnished: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    parking_spaces: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Données JSON — stockées dans PostgreSQL JSONB
    amenities = mapped_column(JSONB, nullable=False, default=list)
    images = mapped_column(JSONB, nullable=False, default=list)

    # Mise en avant / statistiques
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    views_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Agent responsable du bien
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    __table_args__ = (
        # Référence unique PAR société (multi-tenant) — pas globalement.
        UniqueConstraint("company_id", "reference", name="uq_properties_company_reference"),
        # Index GIST pour les requêtes géospatiales (Loi 2)
        Index("idx_properties_location_gist", "location", postgresql_using="gist"),
        # Index tenant standard (Loi 1)
        Index("idx_properties_company", "company_id"),
    )
