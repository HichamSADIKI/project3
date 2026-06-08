"""Router FastAPI — Agent AI Fournisseurs (sous-routes `/vendors/ai/...`).

Quatre endpoints scopés au tenant courant (Loi 1, `company_id` du contexte) +
RBAC. Fournisseur d'un autre tenant ou inexistant → **404** (anti-BOLA).
Gemini non bloquant + repli heuristique déterministe.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.vendors import ai_service
from app.routers.vendors.ai_schemas import (
    Locale,
    VendorChatData,
    VendorChatOut,
    VendorChatRequest,
    VendorInsightsData,
    VendorInsightsOut,
    VendorMessageData,
    VendorMessageOut,
    VendorMessageRequest,
    VendorRiskData,
    VendorRiskOut,
    VendorSendData,
    VendorSendMessageRequest,
    VendorSendOut,
    VendorValidationData,
    VendorValidationOut,
)

router = APIRouter(prefix="/vendors/ai", tags=["vendors-ai"])

_AI_ROLES = ("admin", "manager", "agent")


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "vendors-ai", "status": "ok"}


@router.post(
    "/insights",
    response_model=VendorInsightsOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def insights_endpoint(
    locale: Locale = Query("fr"),
    db: AsyncSession = Depends(get_db_session),
) -> VendorInsightsOut:
    """Synthèse IA du parc fournisseurs du tenant."""
    company_id = await get_company_id(db)
    data = await ai_service.vendors_insights(db, company_id, locale)
    return VendorInsightsOut(data=VendorInsightsData(**data))


@router.post(
    "/chat",
    response_model=VendorChatOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def chat_endpoint(
    body: VendorChatRequest,
    db: AsyncSession = Depends(get_db_session),
) -> VendorChatOut:
    """Copilote conversationnel scopé au parc fournisseurs du tenant."""
    company_id = await get_company_id(db)
    data = await ai_service.vendor_chat(
        db, company_id, [m.model_dump() for m in body.messages], body.locale
    )
    return VendorChatOut(data=VendorChatData(**data))


@router.post(
    "/{party_id}/risk",
    response_model=VendorRiskOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def risk_endpoint(
    party_id: uuid.UUID,
    locale: Locale = Query("fr"),
    db: AsyncSession = Depends(get_db_session),
) -> VendorRiskOut:
    """Score de fiabilité/risque IA d'un fournisseur du tenant (404 si hors tenant)."""
    company_id = await get_company_id(db)
    data = await ai_service.vendor_risk(db, company_id, party_id, locale)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor_not_found")
    return VendorRiskOut(data=VendorRiskData(**data))


@router.post(
    "/{party_id}/validation",
    response_model=VendorValidationOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def validation_endpoint(
    party_id: uuid.UUID,
    locale: Locale = Query("fr"),
    db: AsyncSession = Depends(get_db_session),
) -> VendorValidationOut:
    """Aide IA à la validation d'une inscription fournisseur du tenant (404 sinon)."""
    company_id = await get_company_id(db)
    data = await ai_service.vendor_validation(db, company_id, party_id, locale)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor_not_found")
    return VendorValidationOut(data=VendorValidationData(**data))


@router.post(
    "/{party_id}/message",
    response_model=VendorMessageOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def message_endpoint(
    party_id: uuid.UUID,
    body: VendorMessageRequest,
    db: AsyncSession = Depends(get_db_session),
) -> VendorMessageOut:
    """Brouillon d'outreach (email/WhatsApp) AR/EN/FR pour un fournisseur du tenant."""
    company_id = await get_company_id(db)
    data = await ai_service.vendor_message(
        db, company_id, party_id, body.channel, body.locale, body.purpose
    )
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor_not_found")
    return VendorMessageOut(data=VendorMessageData(**data))


@router.post(
    "/{party_id}/message/send",
    response_model=VendorSendOut,
    dependencies=[Depends(require_roles(*_AI_ROLES))],
)
async def send_message_endpoint(
    party_id: uuid.UUID,
    body: VendorSendMessageRequest,
    db: AsyncSession = Depends(get_db_session),
) -> VendorSendOut:
    """Envoie réellement le message au fournisseur (email via Celery ; WhatsApp →
    template requis). 404 si hors tenant (Loi 1 / anti-BOLA)."""
    company_id = await get_company_id(db)
    data = await ai_service.send_vendor_message(
        db, company_id, party_id, body.channel, body.locale, body.purpose, body.message
    )
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor_not_found")
    return VendorSendOut(data=VendorSendData(**data))
