"""Module self_defense — rapport d'événements du panneau « Self-Defense » (web).

Le panneau (radar / avion / dôme) est un contrôle **UX côté client** (local à la
session) ; ce module ne fait que **persister la trace** de ses événements dans
`audit_logs` (table RLS-exempte, Loi 1 via `company_id`), pour la traçabilité.
Aucun secret (le code de validation) ne transite ni n'est stocké ici.
"""

from app.routers.self_defense.router import router

__all__ = ["router"]
