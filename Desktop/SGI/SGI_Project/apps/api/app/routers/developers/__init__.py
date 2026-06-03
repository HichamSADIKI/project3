"""Module Developers — promoteurs immobiliers UAE (migration 0037).

Annuaire des promoteurs (raison sociale, licence, ville, contact, indicateurs).
Suit le pattern router/schemas/service/test, filtré par `company_id` (Loi 1)."""

from app.routers.developers.router import router

__all__ = ["router"]
