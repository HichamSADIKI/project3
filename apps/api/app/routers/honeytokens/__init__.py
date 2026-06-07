"""Module honeytokens — déception sécurité (Axe 7 de la doctrine `@core/security`).

Des leurres (faux secrets/URLs à haute entropie) plantés par société. Tout accès à
un honeytoken (endpoint *trip*, sans auth) déclenche une **alerte CRITIQUE** + une
entrée d'**audit** pour la société propriétaire — signal quasi-certain d'intrusion.

Loi 1 : table `honeytokens` avec `company_id` + RLS (migration 0062).
"""

from app.routers.honeytokens.admin_router import router as admin_router
from app.routers.honeytokens.router import router

__all__ = ["admin_router", "router"]
