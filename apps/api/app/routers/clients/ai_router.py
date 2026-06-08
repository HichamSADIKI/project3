"""Router FastAPI — Agent AI Clients (sous-routes `/clients/ai/...`).

Quatre endpoints, tous scopés au tenant courant (Loi 1 : `company_id` lu du
contexte, jamais d'une valeur client) et protégés par RBAC. Un client d'un
autre tenant (ou inexistant) renvoie systématiquement **404** (anti-BOLA :
jamais 403, qui divulguerait l'existence). Appels Gemini non bloquants (timeout
court + repli heuristique déterministe).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import require_roles
from app.routers.clients import ai_service
from app.routers.clients.ai_schemas import (
    ClientChatData,
    ClientChatOut,
    ClientChatRequest,
    ClientInsightsData,
    ClientInsightsOut,
    ClientMessageData,
    ClientMessageOut,
    ClientMessageRequest,
    ClientScoreData,
    ClientScoreOut,
    ClientSendData,
    ClientSendMessageRequest,
    ClientSendOut,
    Locale,
)

router = APIRouter(prefix="/clients/ai", tags=["clients-ai"])

_AI_ROLES = ("admin", "manager", "agent")


def _get_company_id(request: Request) -> uuid.UUID:
    """company_id du contexte (posé par TenantMiddleware depuis le JWT) — Loi 1."""
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "clients-ai", "status": "ok"}


@router.post(
    "/insights",
    response_model=ClientInsightsOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def insights_endpoint(
    request: Request,
    locale: Locale = Query("fr"),
    db: AsyncSession = Depends(get_db_session),
) -> ClientInsightsOut:
    """Synthèse IA du portefeuille clients du tenant."""
    company_id = _get_company_id(request)
    data = await ai_service.client_insights(db, company_id, locale)
    return ClientInsightsOut(data=ClientInsightsData(**data))


@router.post(
    "/chat",
    response_model=ClientChatOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def chat_endpoint(
    body: ClientChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ClientChatOut:
    """Copilote conversationnel scopé au portefeuille clients du tenant."""
    company_id = _get_company_id(request)
    data = await ai_service.client_chat(
        db, company_id, [m.model_dump() for m in body.messages], body.locale
    )
    return ClientChatOut(data=ClientChatData(**data))


@router.post(
    "/{client_id}/score",
    response_model=ClientScoreOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def score_endpoint(
    client_id: uuid.UUID,
    request: Request,
    locale: Locale = Query("fr"),
    db: AsyncSession = Depends(get_db_session),
) -> ClientScoreOut:
    """Score de qualification IA d'un client du tenant (404 si hors tenant)."""
    company_id = _get_company_id(request)
    data = await ai_service.client_score(db, company_id, client_id, locale)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="client_not_found")
    return ClientScoreOut(data=ClientScoreData(**data))


@router.post(
    "/{client_id}/message",
    response_model=ClientMessageOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def message_endpoint(
    client_id: uuid.UUID,
    body: ClientMessageRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ClientMessageOut:
    """Brouillon de message (email/WhatsApp) AR/EN/FR pour un client du tenant."""
    company_id = _get_company_id(request)
    data = await ai_service.client_message(
        db, company_id, client_id, body.channel, body.locale, body.purpose
    )
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="client_not_found")
    return ClientMessageOut(data=ClientMessageData(**data))


@router.post(
    "/{client_id}/message/send",
    response_model=ClientSendOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def send_message_endpoint(
    client_id: uuid.UUID,
    body: ClientSendMessageRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ClientSendOut:
    """Envoie réellement le message au client (email via Celery ; WhatsApp →
    template requis). 404 si le client n'appartient pas au tenant (Loi 1/BOLA)."""
    company_id = _get_company_id(request)
    data = await ai_service.send_client_message(
        db, company_id, client_id, body.channel, body.locale, body.purpose, body.message
    )
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="client_not_found")
    return ClientSendOut(data=ClientSendData(**data))
