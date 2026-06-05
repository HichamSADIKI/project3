"""Sous-routeur Admin · Serveurs & réseau (infra-admin, PLATEFORME cross-tenant).

Périmètre B (HORS Loi 1) : état des serveurs/services + métriques réseau (bande
passante, connexions, IP) interrogées en direct sur **Prometheus** (cf.
`app.routers.admin.prometheus`). Lecture seule en Phase 1 (le contrôle réel
start/stop est Phase 3). Garde `require_platform_admin` au niveau routeur (frozen
Wave 0) → JAMAIS exposé sans le drapeau super-admin.

🧩 STUB Wave 0 — l'agent Wave 1 « infra » remplit : GET /servers (registre
`infra_services` + état live), GET /network (métriques Prometheus). Utiliser
`get_db` (PAS get_db_session : périmètre cross-tenant). Tests `test_admin_infra.py`
(mocker le client Prometheus). Dégrader proprement si Prometheus injoignable.
"""

from fastapi import APIRouter, Depends

from app.routers.admin.deps import require_platform_admin

infra_router = APIRouter(
    prefix="/platform",
    tags=["admin-platform"],
    dependencies=[Depends(require_platform_admin)],
)


@infra_router.get("/health")
async def infra_health() -> dict[str, str]:
    return {"section": "admin.platform.infra", "status": "ok"}
