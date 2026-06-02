"""Module AI Copilot — assistance agent (inbox + tickets).

Couche d'orchestration SANS persistance : agrège le contexte d'une conversation
inbox ou d'un ticket, puis renvoie à l'agent un brouillon de réponse, un résumé,
le sentiment/l'intention du dernier message client et les next-best-actions.
Réutilise `app.core.gemini` (repli heuristique pur si la clé est absente).
"""

from app.routers.copilot.router import router

__all__ = ["router"]
