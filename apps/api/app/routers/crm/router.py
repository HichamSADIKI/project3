"""Router CRM — gestion du pipeline de leads et des activités."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_role

from . import service
from .schemas import (
    ActivityCreate,
    ActivityListOut,
    LeadCreate,
    LeadDetailOut,
    LeadListOut,
    LeadStatusUpdate,
    LeadUpdate,
    PipelineKPIOut,
)

router = APIRouter(prefix="/crm", tags=["crm"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_company_id(db: AsyncSession) -> str:
    """Récupère company_id depuis le contexte PostgreSQL (set_config par get_db_session)."""
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    return result.scalar()


def _get_user_id(request: Request) -> uuid.UUID:
    """Récupère user_id depuis request.state (injecté par TenantMiddleware)."""
    raw = getattr(request.state, "user_id", None)
    if raw:
        return uuid.UUID(str(raw))
    # Fallback nil UUID — ne devrait pas arriver en production avec TenantMiddleware
    return uuid.UUID("00000000-0000-0000-0000-000000000000")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/health")
async def health():
    return {"module": "crm", "status": "ok"}


@router.get("/pipeline", response_model=PipelineKPIOut, summary="KPIs pipeline CRM")
async def get_pipeline(
    db: AsyncSession = Depends(get_db_session),
):
    """Retourne le nombre de leads par statut pour le tenant courant."""
    company_id = await _get_company_id(db)
    kpis = await service.get_pipeline_kpis(db, company_id)
    return PipelineKPIOut(data=kpis)


@router.get("/leads", response_model=LeadListOut, summary="Liste des leads")
async def list_leads(
    page: int = Query(1, ge=1, description="Numéro de page"),
    limit: int = Query(20, ge=1, le=100, description="Éléments par page"),
    status: str | None = Query(None, description="Filtre par statut"),
    category: str | None = Query(None, description="Filtre par catégorie/secteur"),
    agent_id: uuid.UUID | None = Query(None, description="Filtre par agent"),
    client_id: uuid.UUID | None = Query(None, description="Filtre par client (party)"),
    q: str | None = Query(None, description="Recherche texte libre"),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager", "agent")),
):
    """Liste paginée des leads du tenant, triés par score décroissant.

    `category` filtre le secteur (realestate, tourisme, sante, …) — c'est ce
    qui alimente le CRM par secteur du back-office avec les deals soumis
    depuis le portail client. `client_id` restreint aux leads d'un client donné
    (utilisé par le call center pour rattacher l'appel au lead existant).
    """
    company_id = await _get_company_id(db)
    items, total = await service.list_leads(
        db,
        company_id,
        page=page,
        limit=limit,
        status=status,
        category=category,
        agent_id=agent_id,
        client_id=client_id,
        q=q,
    )
    pages = (total + limit - 1) // limit
    return LeadListOut(
        data=items,
        meta={"total": total, "page": page, "limit": limit, "pages": pages},
    )


@router.post(
    "/leads",
    response_model=LeadDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un lead",
)
async def create_lead(
    request: Request,
    body: LeadCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager", "agent")),
):
    """
    Crée un nouveau lead CRM.
    Le score est calculé automatiquement selon les règles CLAUDE.md.
    Rôles autorisés : admin, manager, agent.
    """
    company_id = await _get_company_id(db)
    user_id = _get_user_id(request)
    lead = await service.create_lead(db, company_id, body, user_id=user_id)
    return LeadDetailOut(data=lead)


@router.get(
    "/leads/{lead_id}",
    response_model=LeadDetailOut,
    summary="Détail d'un lead",
)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """Retourne le détail complet d'un lead, incluant son score actuel."""
    company_id = await _get_company_id(db)
    lead = await service.get_lead(db, company_id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead_not_found")
    return LeadDetailOut(data=lead)


@router.patch(
    "/leads/{lead_id}",
    response_model=LeadDetailOut,
    summary="Mettre à jour un lead",
)
async def update_lead(
    lead_id: uuid.UUID,
    body: LeadUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager", "agent")),
):
    """
    Met à jour partiellement un lead (PATCH sémantique).
    Recalcule automatiquement le score après mise à jour.
    Rôles autorisés : admin, manager, agent.
    """
    company_id = await _get_company_id(db)
    lead = await service.update_lead(db, company_id, lead_id, body)
    if not lead:
        raise HTTPException(status_code=404, detail="lead_not_found")
    return LeadDetailOut(data=lead)


@router.post(
    "/leads/{lead_id}/status",
    response_model=LeadDetailOut,
    summary="Changer le statut d'un lead",
)
async def update_lead_status(
    lead_id: uuid.UUID,
    request: Request,
    body: LeadStatusUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager", "agent")),
):
    """
    Effectue une transition de statut dans le pipeline CRM.
    Valide la transition selon les règles CLAUDE.md.
    Crée automatiquement une activité 'status_change'.
    Déclenche le workflow Golden Visa si won + budget ≥ 2 000 000 AED.
    Rôles autorisés : admin, manager, agent.
    """
    company_id = await _get_company_id(db)
    user_id = _get_user_id(request)
    lead = await service.update_lead_status(
        db,
        company_id,
        lead_id,
        body,
        user_id=user_id,
    )
    if not lead:
        raise HTTPException(status_code=404, detail="lead_not_found")
    return LeadDetailOut(data=lead)


@router.post(
    "/leads/{lead_id}/activities",
    response_model=ActivityListOut,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une activité sur un lead",
)
async def add_activity(
    lead_id: uuid.UUID,
    request: Request,
    body: ActivityCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_role("admin", "manager", "agent")),
):
    """
    Enregistre une activité (call, email, whatsapp, visit, note) sur le lead.
    Les activités sont immuables — pas de soft delete.
    Met à jour contact_attempts et last_contact_at pour les contacts directs.
    Rôles autorisés : admin, manager, agent.
    """
    # Assure la cohérence : lead_id dans l'URL prime sur celui du body
    body_with_lead = body.model_copy(update={"lead_id": lead_id})
    company_id = await _get_company_id(db)
    user_id = _get_user_id(request)
    await service.add_activity(db, company_id, body_with_lead, user_id=user_id)
    activities = await service.list_activities(db, company_id, lead_id)
    return ActivityListOut(
        data=activities,
        meta={"count": len(activities), "lead_id": str(lead_id)},
    )


@router.get(
    "/leads/{lead_id}/activities",
    response_model=ActivityListOut,
    summary="Liste des activités d'un lead",
)
async def list_activities(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retourne toutes les activités d'un lead, triées chronologiquement (plus récentes en premier).
    Inclut les transitions de statut, appels, emails, WhatsApp, visites et notes.
    """
    company_id = await _get_company_id(db)
    activities = await service.list_activities(db, company_id, lead_id)
    return ActivityListOut(
        data=activities,
        meta={"count": len(activities), "lead_id": str(lead_id)},
    )
