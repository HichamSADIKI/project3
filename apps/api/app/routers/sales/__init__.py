"""Module Vente (sales) — pipeline pré-contrat de vente immobilière.

Mandat de vente → annonce → offre d'achat → transaction conclue (+ commission).
Distinct du module `contracts` qui porte le contrat de vente lui-même (type 'sale') :
ici on gère le funnel commercial qui PRÉCÈDE/accompagne le contrat, pas le contrat.
"""

from app.routers.sales.router import router

__all__ = ["router"]
