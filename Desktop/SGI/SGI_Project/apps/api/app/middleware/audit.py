"""Middleware d'audit — journalise chaque mutation réussie dans `audit_logs`.

S'exécute après `TenantMiddleware` (qui peuple `request.state`), donc le
contexte tenant/utilisateur est disponible. L'écriture DB est déléguée à une
tâche Celery (`app.tasks.audit.write_audit_log`) pour ne pas ralentir la
réponse. Toute défaillance d'audit est silencieuse côté requête (l'audit ne
doit jamais casser une opération métier).
"""
import logging
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)

AUDIT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_ACTION_BY_METHOD = {
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


def _is_uuid(segment: str) -> bool:
    try:
        uuid.UUID(segment)
        return True
    except (ValueError, TypeError):
        return False


def _parse_target(path: str, method: str) -> tuple[str, str | None, str]:
    """Déduit (resource, resource_id, action) depuis le chemin REST.

    Exemples :
    - POST   /api/v1/properties              → ('properties', None, 'create')
    - PATCH  /api/v1/properties/{uuid}        → ('properties', uuid, 'update')
    - DELETE /api/v1/units/{uuid}             → ('units', uuid, 'delete')
    - POST   /api/v1/pdc/{uuid}/deposit       → ('pdc', uuid, 'deposit')
    - POST   /api/v1/tenants/{uuid}/status    → ('tenants', uuid, 'status')
    """
    parts = [p for p in path.split("/") if p]
    if "v1" in parts:
        parts = parts[parts.index("v1") + 1 :]
    elif "api" in parts:
        parts = parts[parts.index("api") + 1 :]
    if not parts:
        return "unknown", None, _ACTION_BY_METHOD.get(method, "action")

    resource = parts[0]
    resource_id: str | None = None
    subaction: str | None = None
    for seg in parts[1:]:
        if _is_uuid(seg):
            resource_id = seg
        else:
            subaction = seg  # dernier segment non-UUID = sous-action

    base = _ACTION_BY_METHOD.get(method, "action")
    if subaction:
        # Sur un POST d'action (ex. /pdc/{id}/deposit) la sous-action prime ;
        # sinon on la concatène (ex. PATCH .../something → 'update:something').
        action = subaction if method == "POST" else f"{base}:{subaction}"
    else:
        action = base
    return resource, resource_id, action


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if (
            request.method in AUDIT_METHODS
            and response.status_code < 400
            and getattr(request.state, "company_id", None)
        ):
            try:
                resource, resource_id, action = _parse_target(
                    request.url.path, request.method
                )
                forwarded = request.headers.get("x-forwarded-for", "")
                ip = (
                    forwarded.split(",")[0].strip()
                    if forwarded
                    else (request.client.host if request.client else None)
                )
                from app.tasks.audit import write_audit_log

                write_audit_log.delay(
                    company_id=str(request.state.company_id),
                    user_id=getattr(request.state, "user_id", None),
                    user_email=getattr(request.state, "email", None),
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    ip_address=ip,
                    user_agent=request.headers.get("user-agent"),
                    request_id=request.headers.get("x-request-id"),
                )
            except Exception as exc:  # noqa: BLE001 — l'audit ne casse jamais la requête
                logger.warning("audit enqueue failed: %s", exc)

        return response
