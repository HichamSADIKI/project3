"""Module Omnichannel Inbox — fils externes (WhatsApp/email/webchat…) unifiés
dans un poste agent. Réutilise le bus temps réel de comms et l'IA d'ai_services."""

from app.routers.inbox.router import router
from app.routers.inbox.webhook import inbox_webhook_router

__all__ = ["inbox_webhook_router", "router"]
