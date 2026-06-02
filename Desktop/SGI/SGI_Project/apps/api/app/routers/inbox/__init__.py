"""Module Omnichannel Inbox — fils externes (WhatsApp/email/webchat…) unifiés
dans un poste agent. Réutilise le bus temps réel de comms et l'IA d'ai_services."""

from app.routers.inbox.router import router

__all__ = ["router"]
