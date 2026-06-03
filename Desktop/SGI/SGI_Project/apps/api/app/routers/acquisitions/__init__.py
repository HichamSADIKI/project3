"""Module Acquisitions — côté acquéreur (sous-catégorie « Achat »).

Mandats d'achat acquéreur + offres d'achat sur des biens, avec moteur de
rapprochement PostGIS (prix / type / chambres / proximité géographique).
"""

from app.routers.acquisitions.router import router

__all__ = ["router"]
