"""Schéma de feuille déclaratif du Studio (modules « lite »).

**Donnée pure, JAMAIS exécutée.** Un module lite stocke un `SheetSchema` (JSON)
dans `studio_modules.schema_json` ; un moteur de rendu générique côté front l'affiche
(text input, bouton, …). Les actions de bouton sont une **liste blanche** de chaînes
sûres (`submit`/`reset`/`navigate`) interprétées par le renderer — aucun code arbitraire,
aucun eval. Validation stricte (Pydantic v2, `extra="forbid"`, tailles bornées, slugs)
pour qu'une entrée mal formée (ou une sortie IA en Phase 1B) soit refusée au lieu d'être
persistée. `schema_version` permet l'évolution future du format.

Ce module est **pur** (Pydantic seulement) → testable sans DB ni FastAPI.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Types d'éléments rendus par le moteur générique (liste blanche).
ElementType = Literal[
    "text",
    "textarea",
    "number",
    "select",
    "checkbox",
    "date",
    "label",
    "button",
]

# Actions de bouton autorisées (liste blanche — chaînes sûres, pas de code).
ButtonAction = Literal["submit", "reset", "navigate"]

# Bornes (anti-abus / anti-DoS sur un schéma généré).
MAX_SHEETS = 20
MAX_ELEMENTS_PER_SHEET = 50
MAX_OPTIONS = 50

_SLUG = r"^[a-z0-9_]+$"


class SelectOption(BaseModel):
    """Une option d'un élément `select`."""

    model_config = ConfigDict(extra="forbid")

    value: str = Field(min_length=1, max_length=120)
    label_ar: str = Field(min_length=1, max_length=200)
    label_en: str = Field(min_length=1, max_length=200)
    label_fr: str = Field(min_length=1, max_length=200)


class Element(BaseModel):
    """Un élément de feuille (champ, libellé ou bouton)."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=_SLUG, min_length=1, max_length=60)
    type: ElementType
    label_ar: str = Field(min_length=1, max_length=200)
    label_en: str = Field(min_length=1, max_length=200)
    label_fr: str = Field(min_length=1, max_length=200)
    placeholder: str | None = Field(default=None, max_length=200)
    required: bool = False
    # `select` uniquement : options proposées.
    options: list[SelectOption] = Field(default_factory=list, max_length=MAX_OPTIONS)
    # `button` uniquement : action (liste blanche). None pour les autres types.
    action: ButtonAction | None = None


class Sheet(BaseModel):
    """Une feuille (écran) = un titre i18n + une liste ordonnée d'éléments."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=_SLUG, min_length=1, max_length=60)
    title_ar: str = Field(min_length=1, max_length=200)
    title_en: str = Field(min_length=1, max_length=200)
    title_fr: str = Field(min_length=1, max_length=200)
    elements: list[Element] = Field(min_length=1, max_length=MAX_ELEMENTS_PER_SHEET)


class SheetSchema(BaseModel):
    """Schéma complet d'un module lite : une ou plusieurs feuilles."""

    model_config = ConfigDict(extra="forbid")

    schema_version: int = Field(default=1, ge=1, le=1)
    sheets: list[Sheet] = Field(min_length=1, max_length=MAX_SHEETS)
