"""Client Meilisearch pour la recherche globale back-office.

Client HTTP léger (httpx) — pas de SDK (aucune dépendance nouvelle). Index unique
`backoffice` multi-entités, filtré par `company_id` (Loi 1) et `entity_type`. La
recherche est **best-effort** : toute erreur Meili est remontée à l'appelant qui
retombe alors sur la recherche DB (ILIKE). Aucune donnée sensible indexée (juste
le libellé/sous-titre déjà affichés à l'agent).
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx

from app.core.config import settings

INDEX = "backoffice"
_TIMEOUT = 4.0


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    key = getattr(settings, "MEILI_MASTER_KEY", "") or ""
    if key:
        h["Authorization"] = f"Bearer {key}"
    return h


def doc_id(company_id: uuid.UUID, entity_type: str, entity_id: str) -> str:
    """Clé primaire Meili : [a-zA-Z0-9-_] uniquement → préfixe tenant + type."""
    return f"{company_id.hex}__{entity_type}__{entity_id.replace('-', '')}"


async def ensure_index() -> None:
    """Crée l'index + règles searchable/filterable. Idempotent, best-effort."""
    base = settings.MEILI_HOST.rstrip("/")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        await c.post(f"{base}/indexes", headers=_headers(), json={"uid": INDEX, "primaryKey": "id"})
        await c.patch(
            f"{base}/indexes/{INDEX}/settings",
            headers=_headers(),
            json={
                "searchableAttributes": ["label", "subtitle", "reference"],
                "filterableAttributes": ["company_id", "entity_type"],
            },
        )


async def reindex(company_id: uuid.UUID, docs: list[dict[str, Any]]) -> int:
    """(Ré)indexe une liste de documents back-office. Retourne le nb poussé."""
    await ensure_index()
    payload = [
        {
            **d,
            "id": doc_id(company_id, d["entity_type"], d["id"]),
            "entity_id": d["id"],
            "company_id": company_id.hex,
        }
        for d in docs
    ]
    if not payload:
        return 0
    base = settings.MEILI_HOST.rstrip("/")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        await c.post(f"{base}/indexes/{INDEX}/documents", headers=_headers(), json=payload)
    return len(payload)


async def search(
    company_id: uuid.UUID, q: str, types: list[str], limit: int
) -> list[dict[str, Any]]:
    """Recherche Meili filtrée par société + types. Lève si Meili indisponible."""
    base = settings.MEILI_HOST.rstrip("/")
    filt: list[Any] = [f'company_id = "{company_id.hex}"']
    if types:
        filt.append([f'entity_type = "{t}"' for t in types])  # OR sur les types
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        resp = await c.post(
            f"{base}/indexes/{INDEX}/search",
            headers=_headers(),
            json={"q": q, "filter": filt, "limit": limit},
        )
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
    out: list[dict[str, Any]] = []
    for h in hits:
        out.append(
            {
                "entity_type": h.get("entity_type", ""),
                "id": h.get("entity_id", ""),
                "label": h.get("label", ""),
                "subtitle": h.get("subtitle"),
                "reference": h.get("reference"),
            }
        )
    return out
