"""Tâche Celery — écriture du journal d'audit.

Queue : reminders (consommée par le worker `-Q notifications,exports,reminders`).
Déclenchée par `AuditMiddleware` sur chaque mutation réussie (POST/PUT/PATCH/DELETE).
L'écriture est asynchrone pour ne pas ralentir la requête HTTP.
"""

from __future__ import annotations

import logging
import uuid

from app.core.database import sync_session_maker
from app.models.audit_log import AuditLog
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _as_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        return None


@celery_app.task(name="app.tasks.audit.write_audit_log", bind=True, queue="reminders")
def write_audit_log(
    self,
    *,
    company_id: str,
    action: str,
    resource: str,
    user_id: str | None = None,
    user_email: str | None = None,
    resource_id: str | None = None,
    changes: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_id: str | None = None,
) -> dict:
    """Persiste une entrée immuable dans `audit_logs`.

    `company_id` est obligatoire (colonne NOT NULL) ; les requêtes anonymes
    (sans tenant) ne sont pas auditées ici et sont filtrées en amont par le
    middleware.
    """
    cid = _as_uuid(company_id)
    if cid is None:
        logger.warning("write_audit_log: company_id invalide, ignoré")
        return {"status": "skipped", "reason": "invalid_company_id"}

    try:
        with sync_session_maker() as db:
            entry = AuditLog(
                company_id=cid,
                user_id=_as_uuid(user_id),
                user_email=user_email,
                action=action[:100],
                resource=resource[:100],
                resource_id=_as_uuid(resource_id),
                changes=changes or {},
                ip_address=ip_address[:45] if ip_address else None,
                user_agent=user_agent[:500] if user_agent else None,
                request_id=request_id[:50] if request_id else None,
            )
            db.add(entry)
            db.commit()
        return {"status": "ok", "resource": resource, "action": action}
    except Exception as exc:  # noqa: BLE001 — l'audit ne doit jamais casser la requête
        logger.error("write_audit_log failed: %s", exc)
        raise self.retry(exc=exc, countdown=60, max_retries=3) from exc
