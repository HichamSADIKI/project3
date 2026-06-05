"""Sous-routeur Admin · Audit applicatif & sécurité des modules (app-admin, tenant).

Périmètre A (Loi 1) : consultation des `audit_logs` de la société (filtres, recherche,
export CSV anti-injection de formule) + vue sécurité « qui accède à quoi ». Lecture seule.
Garde `require_admin` posée au niveau routeur (frozen Wave 0).

🧩 STUB Wave 0 — l'agent Wave 1 « audit » remplit les endpoints (liste filtrée,
export CSV). Toujours via `get_db_session` (RLS). Tests dans `test_admin_audit.py`.
Réutiliser le neutralisateur d'injection CSV existant (cf. export clients, PR #158).
"""

from fastapi import APIRouter, Depends

from app.routers.admin.deps import require_admin

audit_router = APIRouter(prefix="/audit", tags=["admin"], dependencies=[Depends(require_admin)])


@audit_router.get("/health")
async def audit_health() -> dict[str, str]:
    return {"section": "admin.audit", "status": "ok"}
