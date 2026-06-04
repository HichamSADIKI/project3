"""Router FastAPI — AI Copilot (assistance agent).

`POST /copilot/assist` agrège le contexte d'une conversation inbox ou d'un
ticket et renvoie brouillon de réponse + résumé + sentiment + intention +
next-best-actions. Tout est filtré par `company_id` (Loi 1) ; un simple agent
n'assiste que SES items assignés (anti-BOLA : 404, jamais 403).

L'appel est synchrone : `generate_text` (Gemini) a un timeout court (8 s) et
retombe sur un repli heuristique déterministe — jamais bloquant durablement.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import require_roles
from app.routers.copilot import service
from app.routers.copilot.schemas import (
    AssistData,
    AssistOut,
    AssistRequest,
    ChatData,
    ChatOut,
    ChatRequest,
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
    db: AsyncSession = Depends(get_db_session),
) -> AssistOut:
    company_id = _get_company_id(request)
    agent_id = _get_user_id(request)
    role = _get_role(request)

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


@router.post(
    "/chat",
    dependencies=[Depends(require_roles(*_WRITE_ROLES))],
)
async def chat_endpoint(
    body: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ChatOut:
    """Assistant in-app conversationnel (aide à l'usage + navigation + KPI tenant).

    Scopé au tenant courant (Loi 1) ; pas de BOLA par item (aide générale).
    Synchrone non bloquant : Gemini (timeout 8 s) + repli heuristique déterministe.
    """
    company_id = _get_company_id(request)
    result = await service.chat(
        db,
        company_id,
        messages=[m.model_dump() for m in body.messages],
        locale=body.locale,
        screen=body.screen,
    )
    return ChatOut(data=ChatData(**result))
