"""
Floor — niveau intermédiaire optionnel entre Building et Unit.

Présent pour les tours résidentielles (1 ligne par étage). Absent pour les
compounds de villas (les Units sont directement enfants du Building).
"""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class Floor(Base, TimestampMixin, TenantMixin):
    """Niveau (étage) d'un bâtiment. Pas de soft-delete : suit le bâtiment."""

    __tablename__ = "floors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    building_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Niveau (peut être négatif pour sous-sol)
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Label libre (ex : "Ground", "Mezzanine", "Penthouse", "B1")
    label: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Nombre d'unités prévues (capacity planning)
    planned_units: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("building_id", "floor_number", name="uq_floors_building_number"),
        Index("idx_floors_company", "company_id"),
    )
