"""Schémas Pydantic v2 — Recherche globale back-office."""

from pydantic import BaseModel

# Types d'entités cherchables. Sert aussi de filtre `types=` (CSV).
ENTITY_TYPES = ("property", "client", "contract")


class SearchHit(BaseModel):
    """Un résultat de recherche, indépendant de l'entité source."""

    entity_type: str  # "property" | "client" | "contract"
    id: str
    label: str  # titre principal (nom client, titre/réf bien, réf contrat)
    subtitle: str | None = None  # ville, email, statut…
    reference: str | None = None  # référence métier si disponible


class SearchResultOut(BaseModel):
    success: bool = True
    data: list[SearchHit]
    meta: dict[str, int | str | bool]


class ReindexOut(BaseModel):
    success: bool = True
    data: dict[str, int]
