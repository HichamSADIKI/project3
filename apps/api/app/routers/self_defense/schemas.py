"""Schémas Pydantic — événements self-defense.

Le corps n'accepte QUE l'action + le mode (énumérés). Le code de validation n'est
jamais transmis : tout champ supplémentaire est ignoré (comportement Pydantic v2),
donc aucune fuite possible vers l'audit.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SelfDefenseAction = Literal[
    "arm",
    "disarm",
    "mode_radar",
    "mode_avion",
    "mode_dome",
    "code_fail",
    "locked",
]
SelfDefenseMode = Literal["radar", "avion", "dome"]


class SelfDefenseEvent(BaseModel):
    action: SelfDefenseAction
    mode: SelfDefenseMode | None = None


# ── Validation du code (armer / désarmer) ───────────────────────────────────

Purpose = Literal["arm", "disarm"]


class VerifyBody(BaseModel):
    purpose: Purpose
    code: str = Field(min_length=1, max_length=128)


class VerifyResult(BaseModel):
    ok: bool
    locked: bool
    attempts_left: int


class StatusOut(BaseModel):
    """Lu par le dock (tout utilisateur) pour savoir si un code est requis."""

    armgate_enabled: bool
    arm_required: bool
    disarm_required: bool


# ── Administration (admin/manager) ───────────────────────────────────────────


class ConfigUpdate(BaseModel):
    """Codes en clair en ENTRÉE (hashés côté serveur). Vide/absent = inchangé."""

    arm_code: str | None = Field(default=None, max_length=128)
    disarm_code: str | None = Field(default=None, max_length=128)
    max_attempts: int | None = Field(default=None, ge=1, le=10)
    armgate_enabled: bool | None = None
    options: dict[str, Any] | None = None


class ConfigOut(BaseModel):
    """Sortie admin : JAMAIS les hashes — seulement s'ils sont définis."""

    arm_code_set: bool
    disarm_code_set: bool
    max_attempts: int
    armgate_enabled: bool
    options: dict[str, Any]


class ConfigEnvelope(BaseModel):
    success: bool = True
    data: ConfigOut


class LockoutOut(BaseModel):
    user_id: uuid.UUID
    failed_attempts: int
    locked: bool
    locked_at: datetime | None = None


class LockoutsEnvelope(BaseModel):
    success: bool = True
    data: list[LockoutOut]
