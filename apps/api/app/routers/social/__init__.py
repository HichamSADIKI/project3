"""Module Social — publication d'annonces (vente/location) sur les réseaux sociaux.

Suit le pattern router/schemas/service/test, filtré par `company_id` (Loi 1).
Lien polymorphe vers sale_listings / rental_listings (migration 0042)."""

from app.routers.social.router import router

__all__ = ["router"]
