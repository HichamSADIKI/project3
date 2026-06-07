"""Router self-defense (AUTHENTIFIÉ) — enregistre les événements du panneau.

`POST /api/v1/self-defense/event` : écrit une ligne `audit_logs` (écriture
synchrone, fiable et testable ; `audit_logs` est RLS-exempte — isolation par
`company_id` au niveau ligne). Tout utilisateur authentifié de la société peut
tracer SES événements de session. Aucun secret stocké (le code n'est pas transmis).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.routers.self_defense.schemas import SelfDefenseEvent

router = APIRouter(prefix="/self-defense", tags=["self_defense"])


def _company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(status_code=401, detail="authentication_required")
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="invalid_tenant_context") from exc


def _opt_uuid(raw: object) -> uuid.UUID | None:
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        return None


@router.post("/event")
async def record_event(
    body: SelfDefenseEvent,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Trace un événement self-defense dans l'audit (jamais le code de validation)."""
    company_id = _company_id(request)
    db.add(
        AuditLog(
            company_id=company_id,
            user_id=_opt_uuid(getattr(request.state, "user_id", None)),
            user_email=getattr(request.state, "email", None),
            action=f"self_defense:{body.action}",
            resource="self_defense",
            changes={"mode": body.mode} if body.mode else {},
            ip_address=request.client.host if request.client else None,
            user_agent=(request.headers.get("user-agent") or "")[:500] or None,
        )
    )
    await db.commit()
    return {"success": True}
