"""Module Scenarios — générateur de vidéos social media (photos + voix avatar).

Suit le pattern router/schemas/service/test, filtré par `company_id` (Loi 1).
Lien polymorphe vers sale_listings / rental_listings (migration 0043).
Génération vidéo/voix = STUB (MVP) — voir app/tasks/scenarios.py."""

from app.routers.scenarios.router import router

__all__ = ["router"]
