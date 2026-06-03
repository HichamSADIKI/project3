"""Vitrine immobilière publique (mono-agence).

API catalogue SANS JWT : lecture des annonces *publiées* (vente + location) +
capture de leads. Le tenant est résolu via `settings.PUBLIC_SITE_COMPANY_SLUG`
puis le GUC RLS est posé manuellement (la RLS reste donc active malgré l'absence
de middleware tenant). Aucun champ interne/financier sensible n'est exposé.
"""

from app.routers.public_site.router import router

__all__ = ["router"]
