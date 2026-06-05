"""Dépendances partagées du module Admin Console.

Centralise les DEUX gardes du module pour que les sous-routeurs (remplis en
Wave 1) les réutilisent sans réécrire la frontière de sécurité :

- `require_admin` / `require_admin_write` : app-admin, scopé tenant (Loi 1).
- `require_platform_admin` : infra-admin, cross-tenant (hors Loi 1).

⚠️ Les sous-routeurs `/platform/*` montent `require_platform_admin` au niveau
routeur. Les sous-routeurs app-admin montent `require_admin`. Ne pas mélanger.

Garde de rôle : on distingue **non authentifié → 401** de **rôle insuffisant →
403** (cohérent avec `require_platform_admin`). On NE réutilise PAS
`core.deps.require_role` (rôle seul → 403 même sur une requête anonyme) : cette
dépendance est partagée par ~43 routers ; on garde donc la sémantique correcte
**locale** au module admin plutôt que de modifier le core et son rayon d'impact.
"""

from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, status

from app.core.deps import require_platform_admin


def _require_admin_role(*roles: str) -> Callable[[Request], Awaitable[None]]:
    """401 si aucun utilisateur authentifié, 403 si le rôle n'est pas autorisé."""

    async def checker(request: Request) -> None:
        if getattr(request.state, "user_id", None) is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="authentication_required",
            )
        if getattr(request.state, "role", None) not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    return checker


# App-admin : lecture de la console (admin + manager d'un tenant).
require_admin = _require_admin_role("admin", "manager")
# App-admin : écritures sensibles (création/modif users, rôles) → admin seul.
require_admin_write = _require_admin_role("admin")

__all__ = ["require_admin", "require_admin_write", "require_platform_admin"]
