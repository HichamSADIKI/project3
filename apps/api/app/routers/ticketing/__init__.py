"""Module Ticketing SLA — service desk client (priorité, SLA, escalade, Kanban).
Distinct de la maintenance immobilière ; réutilise les patterns SLA de maintenance."""

from app.routers.ticketing.router import router

__all__ = ["router"]
