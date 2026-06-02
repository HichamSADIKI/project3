"""Module Leasing — sous-catégorie « Location ».

Annonces de location (`rental_listings`) + candidatures locataires
(`rental_applications`). Une candidature approuvée aboutit à un bail `rentals`
(la création effective du bail reste un point d'intégration documenté).
Suit le pattern router/schemas/service/test, filtré par `company_id` (Loi 1)."""

from app.routers.leasing.router import router

__all__ = ["router"]
