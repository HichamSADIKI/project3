"""Schémas Pydantic — événements self-defense.

Le corps n'accepte QUE l'action + le mode (énumérés). Le code de validation n'est
jamais transmis : tout champ supplémentaire est ignoré (comportement Pydantic v2),
donc aucune fuite possible vers l'audit.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

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
