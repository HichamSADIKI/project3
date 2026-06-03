"""Modèles SQLAlchemy — IAM (migration 0036_iam).

Deux axes d'héritage (cf. `service.resolve_effective`) :
- Ressources : `PermissionNode` (arbre auto-référencé catégorie→page→section→champ/action).
  Le catalogue **système** a `company_id` NULL (lisible par tous) ; une société peut
  ajouter ses propres nœuds (company_id renseigné).
- Sujets : `Group` (groupe) → `Unit` (sous-groupe) → utilisateur, reliés par
  `GroupMember`/`UnitMember`. Les droits sont portés par `AccessGrant`.

RLS via company_id (Loi 1) — sauf le catalogue système (company_id NULL). Tables
d'association sans timestamps superflus. Dates timezone-aware.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class PermissionNode(Base, TimestampMixin):
    """Nœud de l'arbre des ressources. `company_id` NULL = nœud système global.

    N'utilise PAS TenantMixin (company_id doit être NULLABLE pour le catalogue système).
    """

    __tablename__ = "permission_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permission_nodes.id", ondelete="CASCADE"), nullable=True
    )
    # Clé stable et hiérarchique : "realestate.contracts.delete".
    key: Mapped[str] = mapped_column(String(150), nullable=False)
    type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # category|page|section|field|action
    label_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    label_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    label_fr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nav_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    screen_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    api_method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    api_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Group(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Groupe (ex. Comptabilité). Les 5 rôles y sont seedés en `is_system=True`."""

    __tablename__ = "iam_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(160), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(160), nullable=True)
    name_fr: Mapped[str | None] = mapped_column(String(160), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Unit(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Unité = sous-groupe d'un groupe (ex. Caissière ⊂ Comptabilité). Profondeur fixe."""

    __tablename__ = "iam_units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("iam_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    name_ar: Mapped[str | None] = mapped_column(String(160), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(160), nullable=True)
    name_fr: Mapped[str | None] = mapped_column(String(160), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class GroupMember(Base):
    """Appartenance utilisateur ↔ groupe (multiple). Table d'association légère."""

    __tablename__ = "iam_group_members"

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("iam_groups.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class UnitMember(Base):
    """Appartenance utilisateur ↔ unité (multiple). Hérite du groupe parent à la résolution."""

    __tablename__ = "iam_unit_members"

    unit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("iam_units.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AccessGrant(Base, TimestampMixin, TenantMixin):
    """Droit d'un sujet (groupe|unité|utilisateur) sur un nœud. allow|deny + scope ABAC."""

    __tablename__ = "iam_access_grants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_type: Mapped[str] = mapped_column(String(10), nullable=False)  # group|unit|user
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permission_nodes.id", ondelete="CASCADE"), nullable=False
    )
    effect: Mapped[str] = mapped_column(String(5), nullable=False)  # allow|deny
    scope: Mapped[str] = mapped_column(String(10), nullable=False, default="all")  # all|own|branch
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
