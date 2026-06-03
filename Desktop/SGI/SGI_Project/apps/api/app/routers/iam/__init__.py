"""Module IAM — gestion des accès & permissions hiérarchiques (migration 0036).

Deux axes d'héritage :
- Arbre des RESSOURCES (`permission_nodes`) : catégorie → page → section → champ / action.
- Chaîne des SUJETS : groupe → unité (sous-groupe) → utilisateur (override).

Voir `catalogue.py` (arbre statique + grants par défaut des rôles) et `service.py`
(`resolve_effective` : moteur d'héritage pur, testable sans DB).
"""

from app.routers.iam.router import router

__all__ = ["router"]
