"""Sous-routeur Admin · Utilisateurs / groupes / permissions (app-admin, tenant).

Périmètre A (Loi 1) : gère les utilisateurs et leurs droits PAR société, au-dessus
du module `iam`. Garde `require_admin` posée au niveau routeur (frozen Wave 0).

🧩 STUB Wave 0 — l'agent Wave 1 « users » remplit les endpoints ici (liste/détail
users, activation, attribution de rôle, groupes/permissions IAM). Toujours filtrer
par company_id via `get_db_session` (RLS). Tests dans `test_admin_users.py`.
"""

from fastapi import APIRouter, Depends

from app.routers.admin.deps import require_admin

users_router = APIRouter(prefix="/users", tags=["admin"], dependencies=[Depends(require_admin)])


@users_router.get("/health")
async def users_health() -> dict[str, str]:
    return {"section": "admin.users", "status": "ok"}
