"""Schémas Pydantic v2 — IAM.

Enveloppes standard `{success, data, meta?}`. Toutes les entrées/sorties des
endpoints IAM passent par ici.
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

# ── Catalogue (arbre des ressources) ────────────────────────────────────────────


class NodeOut(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None
    key: str
    type: str
    label_ar: str | None
    label_en: str | None
    label_fr: str | None
    nav_key: str | None
    screen_key: str | None
    sort_order: int

    model_config = {"from_attributes": True}


class CatalogueOut(BaseModel):
    success: bool = True
    data: list[NodeOut]


# ── Groupes ──────────────────────────────────────────────────────────────────────


class GroupOut(BaseModel):
    id: uuid.UUID
    slug: str
    name_ar: str | None
    name_en: str | None
    name_fr: str | None
    description: str | None
    is_system: bool

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=60)
    name_ar: str | None = Field(None, max_length=160)
    name_en: str | None = Field(None, max_length=160)
    name_fr: str | None = Field(None, max_length=160)
    description: str | None = None


class GroupUpdate(BaseModel):
    name_ar: str | None = Field(None, max_length=160)
    name_en: str | None = Field(None, max_length=160)
    name_fr: str | None = Field(None, max_length=160)
    description: str | None = None


class GroupListOut(BaseModel):
    success: bool = True
    data: list[GroupOut]
    meta: dict[str, Any]


class GroupItemOut(BaseModel):
    success: bool = True
    data: GroupOut


# ── Unités (sous-groupes) ────────────────────────────────────────────────────────


class UnitOut(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    code: str | None
    name_ar: str | None
    name_en: str | None
    name_fr: str | None
    description: str | None

    model_config = {"from_attributes": True}


class UnitCreate(BaseModel):
    group_id: uuid.UUID
    code: str | None = Field(None, max_length=60)
    name_ar: str | None = Field(None, max_length=160)
    name_en: str | None = Field(None, max_length=160)
    name_fr: str | None = Field(None, max_length=160)
    description: str | None = None


class UnitUpdate(BaseModel):
    code: str | None = Field(None, max_length=60)
    name_ar: str | None = Field(None, max_length=160)
    name_en: str | None = Field(None, max_length=160)
    name_fr: str | None = Field(None, max_length=160)
    description: str | None = None


class UnitListOut(BaseModel):
    success: bool = True
    data: list[UnitOut]
    meta: dict[str, Any]


class UnitItemOut(BaseModel):
    success: bool = True
    data: UnitOut


# ── Appartenances ────────────────────────────────────────────────────────────────


class MemberBody(BaseModel):
    user_id: uuid.UUID


# ── Grants (matrice) ─────────────────────────────────────────────────────────────


class GrantItem(BaseModel):
    node_key: str
    effect: Literal["allow", "deny"]
    scope: Literal["all", "own", "branch"] = "all"


class GrantsUpsert(BaseModel):
    """Pose/retire en masse les grants d'UN sujet. Une clé absente de `items`
    et présente côté serveur sera supprimée (retour à l'héritage)."""

    subject_type: Literal["group", "unit", "user"]
    subject_id: uuid.UUID
    items: list[GrantItem]


class GrantOut(BaseModel):
    node_key: str
    effect: str
    scope: str


class GrantsOut(BaseModel):
    success: bool = True
    data: list[GrantOut]
    meta: dict[str, Any]


# ── Permissions effectives (résolues) ────────────────────────────────────────────


class EffectiveEntry(BaseModel):
    effect: str
    source: str
    via_node: str | None


class EffectiveOut(BaseModel):
    success: bool = True
    # node_key -> {effect, source, via_node}
    data: dict[str, EffectiveEntry]
    # set des clés autorisées (pratique pour le frontend)
    allowed: list[str]


class MePermissionsOut(BaseModel):
    """Permissions de l'utilisateur courant — payload d'hydratation du frontend."""

    success: bool = True
    allowed: list[str]  # clés de nœuds autorisées (gating champ via <Can>)
    nav_known: list[str]  # nav_keys modélisés au catalogue (donc à gater)
    nav_allowed: list[str]  # nav_keys autorisés
    screen_known: list[str]
    screen_allowed: list[str]


# ── Utilisateurs (CRUD staff interne) ────────────────────────────────────────────


class UserGroupRef(BaseModel):
    id: uuid.UUID
    slug: str | None = None
    name_fr: str | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    status: str
    is_active: bool
    preferred_language: str
    group_ids: list[uuid.UUID] = []
    unit_ids: list[uuid.UUID] = []

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["admin", "manager", "agent"] = "agent"
    preferred_language: Literal["ar", "en", "fr"] = "en"
    group_ids: list[uuid.UUID] = []
    unit_ids: list[uuid.UUID] = []


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    role: Literal["admin", "manager", "agent"] | None = None
    status: Literal["active", "suspended"] | None = None
    preferred_language: Literal["ar", "en", "fr"] | None = None
    group_ids: list[uuid.UUID] | None = None
    unit_ids: list[uuid.UUID] | None = None


class UserListOut(BaseModel):
    success: bool = True
    data: list[UserOut]
    meta: dict[str, Any]


class UserItemOut(BaseModel):
    success: bool = True
    data: UserOut
