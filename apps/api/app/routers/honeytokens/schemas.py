"""Schémas Pydantic v2 — honeytokens.

Le `token` (secret du leurre) n'est exposé QUE dans la sortie admin authentifiée
(l'admin doit le voir pour planter le leurre). L'endpoint public *trip* ne renvoie
jamais de donnée — réponse neutre.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

HoneytokenKind = Literal["api_key", "url", "secret", "record"]


class HoneytokenCreate(BaseModel):
    """Entrée admin : type + libellé (le token est généré côté serveur)."""

    kind: HoneytokenKind = "api_key"
    label: str = Field(min_length=1, max_length=160)


class HoneytokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    label: str
    token: str  # secret du leurre — visible par l'admin du tenant uniquement
    is_active: bool
    last_triggered_at: datetime | None = None
    trigger_count: int
    created_at: datetime


class HoneytokenEnvelope(BaseModel):
    success: bool = True
    data: HoneytokenOut


class HoneytokenListEnvelope(BaseModel):
    success: bool = True
    data: list[HoneytokenOut]
