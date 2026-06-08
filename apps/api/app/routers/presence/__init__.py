"""Module presence — présence live des utilisateurs (heartbeat) pour la surveillance.

Chaque navigateur envoie un heartbeat périodique portant la session + la page
courante (catégorie/sous-catégorie/page) ; le backend résout la géo de l'IP (local,
PDPL-safe) et tient les sessions actives. Sert le panneau de surveillance Self-Defense.

Loi 1 : table `presence_session` avec `company_id` + RLS (migration 0065).
"""

from app.routers.presence.router import router

__all__ = ["router"]
