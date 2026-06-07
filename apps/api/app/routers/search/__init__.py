"""Module Recherche globale (back-office) — biens · clients · contrats.

Recherche unifiée multi-entités, scopée tenant (Loi 1). Meilisearch quand
l'index est peuplé (tolérance aux fautes), repli DB ILIKE sinon (best-effort).
"""

from app.routers.search.router import router

__all__ = ["router"]
