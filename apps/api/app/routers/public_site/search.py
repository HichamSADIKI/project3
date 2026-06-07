"""Recherche full-text Meilisearch pour la vitrine publique.

Client HTTP léger (httpx) — pas de SDK Meili (aucune nouvelle dépendance). Index
unique `public_listings`, filtré par `company_id` (isolation mono-agence). La
recherche est **best-effort** : toute erreur Meili → l'appelant retombe sur la
recherche DB (substring). Aucune donnée sensible indexée (mêmes champs publics).
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import settings


def _jsonable(doc: dict[str, Any]) -> dict[str, Any]:
    """Rend un document indexable en JSON (Decimal → float)."""
    return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in doc.items()}


INDEX = "public_listings"
_TIMEOUT = 4.0


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    key = getattr(settings, "MEILI_MASTER_KEY", "") or ""
    if key:
        h["Authorization"] = f"Bearer {key}"
    return h


def _doc_id(company_id: uuid.UUID, slug: str) -> str:
    # Clé primaire Meili : [a-zA-Z0-9-_] uniquement → préfixe tenant (anti-collision).
    return f"{company_id.hex}__{slug}"


async def ensure_index() -> None:
    """Crée l'index + règle searchable/filterable/sortable. Idempotent, best-effort."""
    base = settings.MEILI_HOST.rstrip("/")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        await c.post(f"{base}/indexes", headers=_headers(), json={"uid": INDEX, "primaryKey": "id"})
        await c.patch(
            f"{base}/indexes/{INDEX}/settings",
            headers=_headers(),
            json={
                "searchableAttributes": [
                    "title",
                    "title_en",
                    "title_ar",
                    "title_fr",
                    "city",
                    "district",
                    "unit_type",
                    "reference",
                ],
                "filterableAttributes": [
                    "company_id",
                    "deal",
                    "unit_type",
                    "bedrooms",
                    "is_featured",
                ],
                "sortableAttributes": ["price"],
            },
        )


async def reindex(company_id: uuid.UUID, listings: list[dict]) -> int:
    """(Ré)indexe les annonces publiées d'une société. Retourne le nb de docs poussés."""
    await ensure_index()
    docs: list[dict[str, Any]] = []
    for row in listings:
        slug = row.get("slug")
        if not slug:
            continue
        docs.append(
            _jsonable(
                {
                    **row,
                    "id": _doc_id(company_id, slug),
                    "company_id": company_id.hex,
                    # price en float pour le tri Meili.
                    "price": float(row["price"]) if row.get("price") is not None else None,
                }
            )
        )
    if not docs:
        return 0
    base = settings.MEILI_HOST.rstrip("/")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        await c.post(f"{base}/indexes/{INDEX}/documents", headers=_headers(), json=docs)
    return len(docs)


async def search(
    company_id: uuid.UUID, q: str, *, deal: str | None = None, limit: int = 12
) -> list[dict]:
    """Recherche Meili filtrée par société. Lève en cas d'erreur (→ fallback DB)."""
    base = settings.MEILI_HOST.rstrip("/")
    filt = [f'company_id = "{company_id.hex}"']
    if deal in ("sale", "rent"):
        filt.append(f'deal = "{deal}"')
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        resp = await c.post(
            f"{base}/indexes/{INDEX}/search",
            headers=_headers(),
            json={"q": q, "filter": filt, "limit": limit},
        )
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
    # Nettoie les champs techniques d'index avant de renvoyer des dicts d'annonce.
    for h in hits:
        h.pop("id", None)
        h.pop("company_id", None)
    return hits
