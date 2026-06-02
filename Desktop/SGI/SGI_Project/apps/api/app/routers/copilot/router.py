"""Router FastAPI — AI Copilot (assistance agent).

`POST /copilot/assist` agrège le contexte d'une conversation inbox ou d'un
ticket et renvoie brouillon de réponse + résumé + sentiment + intention +
next-best-actions. Tout est filtré par `company_id` (Loi 1) ; un simple agent
n'assiste que SES items assignés (anti-BOLA : 404, jamais 403).

`?push=true` bascule en mode asynchrone : enqueue une tâche Celery qui pousse
le résultat en temps réel sur le canal WS de l'agent (202 immédiat).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import require_roles
from app.routers.copilot import service
from app.routers.copilot.schemas import (
    AssistData,
    AssistOut,
    AssistQueuedData,
    AssistQueuedOut,
    AssistRequest,
)

router = APIRouter(prefix="/copilot", tags=["copilot"])

_WRITE_ROLES = ("admin", "manager", "agent")


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


def _get_user_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "user_id", None)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_context_missing")
    return uuid.UUID(raw)


def _get_role(request: Request) -> str | None:
    return getattr(request.state, "role", None)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "copilot", "status": "ok"}


@router.post(
    "/assist",
    dependencies=[Depends(require_roles(*_WRITE_ROLES))],
)
async def assist_endpoint(
    body: AssistRequest,
    request: Request,
    push: bool = Query(False),
    db: AsyncSession = Depends(get_db_session),
) -> AssistOut | AssistQueuedOut:
    company_id = _get_company_id(request)
    agent_id = _get_user_id(request)
    role = _get_role(request)

    if push:
        # Mode asynchrone : la tâche re-agrège le contexte sous la même garde de
        # visibilité (anti-BOLA) et publie le résultat sur le canal WS agent.
        from app.tasks.copilot import assist_async

        assist_async.delay(  # type: ignore[attr-defined]
            str(company_id),
            body.context_type,
            str(body.context_id),
            str(agent_id),
            role,
            body.locale,
        )
        return AssistQueuedOut(
            data=AssistQueuedData(context_type=body.context_type, context_id=body.context_id)
        )

    result = await service.assist(
        db,
        company_id,
        context_type=body.context_type,
        context_id=body.context_id,
        agent_id=agent_id,
        role=role,
        locale=body.locale,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="context_not_found")
    return AssistOut(data=AssistData(**result))
