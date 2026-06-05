"""Dépendances partagées du module Admin Console.

Centralise les DEUX gardes du module pour que les sous-routeurs (remplis en
Wave 1) les réutilisent sans réécrire la frontière de sécurité :

- `require_admin` / `require_admin_write` : app-admin, scopé tenant (Loi 1).
- `require_platform_admin` : infra-admin, cross-tenant (hors Loi 1).

⚠️ Les sous-routeurs `/platform/*` montent `require_platform_admin` au niveau
routeur. Les sous-routeurs app-admin montent `require_admin`. Ne pas mélanger.
"""

from app.core.deps import require_platform_admin, require_role

# App-admin : lecture de la console (admin + manager d'un tenant).
require_admin = require_role("admin", "manager")
# App-admin : écritures sensibles (création/modif users, rôles) → admin seul.
require_admin_write = require_role("admin")

__all__ = ["require_admin", "require_admin_write", "require_platform_admin"]
