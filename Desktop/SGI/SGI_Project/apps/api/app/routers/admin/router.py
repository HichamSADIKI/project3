"""Router FastAPI — Admin Console (agrégateur).

Monte les 4 sous-routeurs du module. La frontière de sécurité est portée par
CHAQUE sous-routeur (au niveau routeur), pas ici :

- App-admin (tenant, Loi 1)        : /admin/users, /admin/audit   → require_admin
- Infra-admin (plateforme, hors L1): /admin/platform/*            → require_platform_admin

⚠️ Fichier « registre » figé en Wave 0 — ne pas éditer pendant le fan-out Wave 1
(chaque agent remplit SON sous-routeur, jamais cet agrégateur).
"""

from fastapi import APIRouter

from app.routers.admin.audit import audit_router
from app.routers.admin.backups import backups_router
from app.routers.admin.infra import infra_router
from app.routers.admin.users import users_router

router = APIRouter(prefix="/admin")

# Périmètre A — app-admin (tenant).
router.include_router(users_router)
router.include_router(audit_router)
# Périmètre B — infra-admin (plateforme, cross-tenant).
router.include_router(infra_router)
router.include_router(backups_router)


@router.get("/health", tags=["admin"])
async def health() -> dict[str, str]:
    return {"module": "admin", "status": "ok"}
