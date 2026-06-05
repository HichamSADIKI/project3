"""Sous-routeur Admin · Supervision des sauvegardes (infra-admin, PLATEFORME).

Périmètre B (HORS Loi 1) : état des sauvegardes (`backup_runs`) — DB PostgreSQL &
stockage MinIO : statut/âge/taille, dernier succès, alerte si échec. Lecture seule
en Phase 1 (le déclenchement et la restauration sont Phase 3). Garde
`require_platform_admin` au niveau routeur (frozen Wave 0).

🧩 STUB Wave 0 — l'agent Wave 1 « backups » remplit : GET /backups (liste +
résumé par cible). Utiliser `get_db` (cross-tenant). Tests `test_admin_backups.py`.
"""

from fastapi import APIRouter, Depends

from app.routers.admin.deps import require_platform_admin

backups_router = APIRouter(
    prefix="/platform/backups",
    tags=["admin-platform"],
    dependencies=[Depends(require_platform_admin)],
)


@backups_router.get("/health")
async def backups_health() -> dict[str, str]:
    return {"section": "admin.platform.backups", "status": "ok"}
