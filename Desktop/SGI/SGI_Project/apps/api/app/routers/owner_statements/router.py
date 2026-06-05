"""Router FastAPI — Relevés propriétaires (M6). Endpoints imbriqués sous /owners."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.notifications.service import create_notification
from app.routers.owner_statements import service
from app.routers.owner_statements.schemas import (
    OwnerStatementListOut,
    OwnerStatementOut,
    OwnerStatementResponse,
)
from app.routers.owner_statements.service import statement_period_label
from app.tasks.notifications import deliver_email_notification

router = APIRouter(prefix="/owners", tags=["owner-statements"])


@router.post(
    "/{party_id}/statements",
    response_model=OwnerStatementResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager", "agent"))],
)
async def generate_statement_endpoint(
    party_id: uuid.UUID,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db_session),
) -> OwnerStatementResponse:
    company_id = await get_company_id(db)
    owner = await service.get_owner(db, company_id, party_id)
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="owner_not_found")
    statement = await service.generate_statement(db, company_id, owner, year, month)
    title = f"Relevé {statement_period_label(year, month)} disponible"
    body = f"Payout net : {statement.net_payout_aed} AED"
    # Notifie le propriétaire que son relevé est prêt (in-app, toujours).
    await create_notification(
        db,
        company_id,
        notif_type="statement_ready",
        title=title,
        body=body,
        recipient_party_id=party_id,
        payload={"statement_id": str(statement.id)},
    )
    # Doublon e-mail si le propriétaire l'a activé ET qu'on a une adresse.
    # La notif e-mail (canal "email", statut pending) est enfilée vers le worker
    # qui l'enverra et la passera à "sent" (cf. tasks.notifications.send_email).
    if owner.monthly_statement_enabled:
        email = await service.get_owner_email(db, company_id, party_id)
        if email:
            email_notif = await create_notification(
                db,
                company_id,
                notif_type="statement_ready",
                title=title,
                body=body,
                channel="email",
                recipient_party_id=party_id,
                payload={"statement_id": str(statement.id)},
            )
            deliver_email_notification(email_notif, to=email)
    return OwnerStatementResponse(data=OwnerStatementOut.model_validate(statement))


@router.get("/{party_id}/statements", response_model=OwnerStatementListOut)
async def list_statements_endpoint(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> OwnerStatementListOut:
    company_id = await get_company_id(db)
    statements = await service.list_statements(db, company_id, party_id)
    return OwnerStatementListOut(
        data=[OwnerStatementOut.model_validate(s) for s in statements],
        meta={"total": len(statements)},
    )


@router.get("/{party_id}/statements/{statement_id}", response_model=OwnerStatementResponse)
async def get_statement_endpoint(
    party_id: uuid.UUID,
    statement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> OwnerStatementResponse:
    company_id = await get_company_id(db)
    statement = await service.get_statement(db, company_id, statement_id)
    if statement is None or statement.owner_party_id != party_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="statement_not_found")
    return OwnerStatementResponse(data=OwnerStatementOut.model_validate(statement))


@router.post(
    "/{party_id}/statements/{statement_id}/send",
    response_model=OwnerStatementResponse,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def send_statement_endpoint(
    party_id: uuid.UUID,
    statement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> OwnerStatementResponse:
    company_id = await get_company_id(db)
    statement = await service.get_statement(db, company_id, statement_id)
    if statement is None or statement.owner_party_id != party_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="statement_not_found")
    # Garde de transition : seul un relevé en brouillon peut être envoyé (évite de
    # ré-écraser sent_at / de « renvoyer » un relevé déjà envoyé).
    if statement.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="statement_not_draft",
        )
    statement = await service.mark_sent(db, statement)
    return OwnerStatementResponse(data=OwnerStatementOut.model_validate(statement))
