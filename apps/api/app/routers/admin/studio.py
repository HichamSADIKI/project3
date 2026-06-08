"""Sous-routeur Admin · Studio de Modules (infra-admin, PLATEFORME cross-tenant).

Périmètre B (HORS Loi 1) : conception de NOUVEAUX modules applicatifs depuis l'app.
Garde `require_platform_admin` au niveau routeur (frozen Wave 0) → JAMAIS exposé sans
le drapeau super-admin. Utilise `get_db` (PAS `get_db_session` : pas de contexte tenant ;
ces tables n'ont pas de company_id).

Gouvernance d'intégration = **2 yeux (4-eyes)** : un admin demande (`request-integration`,
raison + ticket + TTL), un admin DISTINCT approuve (`approve-integration`). Remplace le
mot de passe en dur initialement demandé (secret en dur = refus doctrine). L'intégration
n'auto-merge JAMAIS : Phase 0 bascule un flag plateforme réversible ; Phase 3 (code)
marquera au mieux une PR prête, le merge restant la gate humaine « GO #PR ».

Phase 0 : l'orchestrateur de codegen est **stubbé en dry-run** (aucun git/gh/subprocess).
`build` simule le pipeline (draft → built → tested → audited) pour exercer la gouvernance.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.studio import StudioIntegrationRequest, StudioModule
from app.routers.admin.deps import require_platform_admin
from app.routers.admin.studio_schema import SheetSchema

logger = logging.getLogger(__name__)

studio_router = APIRouter(
    prefix="/platform/studio",
    tags=["admin-platform"],
    dependencies=[Depends(require_platform_admin)],
)


# ── Machine à états du cycle de vie (helpers PURS, testables) ──────────────────

VALID_STATES: frozenset[str] = frozenset(
    {
        "draft",
        "built",
        "tested",
        "audited",
        "pr_open",
        "approved",
        "integrated",
        "rejected",
        "failed",
    }
)

# Transitions autorisées. `pr_open` est réservé au flavor "code" (Phase 3) ; le flavor
# "lite" va directement `audited → approved`. `failed → draft` permet de réessayer.
_ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"built", "failed"}),
    "built": frozenset({"tested", "failed"}),
    "tested": frozenset({"audited", "failed"}),
    "audited": frozenset({"pr_open", "approved", "rejected", "failed"}),
    "pr_open": frozenset({"approved", "rejected", "failed"}),
    "approved": frozenset({"integrated", "rejected"}),
    "integrated": frozenset(),  # terminal
    "rejected": frozenset(),  # terminal
    "failed": frozenset({"draft"}),
}


def can_transition(src: str, dst: str) -> bool:
    """Transition `src → dst` autorisée par la machine à états ? Helper PUR."""
    return dst in _ALLOWED_TRANSITIONS.get(src, frozenset())


def integration_ttl_minutes() -> int:
    """Fenêtre de validité d'une demande d'intégration (TTL). Défaut 60 min. Helper pur."""
    raw = os.getenv("STUDIO_INTEGRATION_TTL_MINUTES", "60").strip()
    try:
        value = int(raw)
    except ValueError:
        return 60
    return value if value > 0 else 60


def codegen_enabled() -> bool:
    """Exécution réelle du codegen (Phase 3) activée ? Défaut false → dry-run. Helper pur."""
    return os.getenv("STUDIO_CODEGEN_ENABLED", "false").strip().lower() == "true"


def is_expired(expires_at: datetime, now: datetime) -> bool:
    """La demande est-elle expirée à l'instant `now` ? Helper PUR (testable sans DB)."""
    return now >= expires_at


# ── Schémas Pydantic v2 ────────────────────────────────────────────────────────


class ModuleCreate(BaseModel):
    # `populate_by_name` : le champ s'appelle `sheet_schema` côté code (évite de masquer
    # la méthode dépréciée `BaseModel.schema_json`), mais le wire reste `schema_json`.
    model_config = {"populate_by_name": True}

    # `key` borné (anti-injection) — il alimentera branches/chemins en Phase 3.
    key: str = Field(pattern=r"^[a-z0-9_.]+$", min_length=2, max_length=120)
    title_ar: str = Field(min_length=1, max_length=200)
    title_en: str = Field(min_length=1, max_length=200)
    title_fr: str = Field(min_length=1, max_length=200)
    flavor: Literal["lite", "code"] = "lite"
    mode: Literal["ai", "manual"] = "manual"
    sheet_schema: dict[str, Any] | None = Field(default=None, alias="schema_json")


class ModuleOut(BaseModel):
    id: uuid.UUID
    key: str
    title_ar: str
    title_en: str
    title_fr: str
    flavor: str
    mode: str
    state: str
    is_integrated: bool
    pr_url: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ModuleDetailOut(BaseModel):
    success: bool = True
    data: ModuleOut


class ModuleListOut(BaseModel):
    success: bool = True
    data: list[ModuleOut]
    meta: dict[str, Any]


class IntegrationRequestCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    ticket_ref: str | None = Field(default=None, max_length=120)


class IntegrationRequestOut(BaseModel):
    id: uuid.UUID
    module_id: uuid.UUID
    requested_by: uuid.UUID
    reason: str
    ticket_ref: str | None
    status: str
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class IntegrationRequestDetailOut(BaseModel):
    success: bool = True
    data: IntegrationRequestOut


class IntegrationRequestListOut(BaseModel):
    success: bool = True
    data: list[IntegrationRequestOut]
    meta: dict[str, Any]


# ── Helpers internes (I/O) ─────────────────────────────────────────────────────


def _actor_company_id(request: Request) -> uuid.UUID | None:
    """company_id de l'acteur (pour la ligne d'audit). Les platform-admins en ont un."""
    raw = getattr(request.state, "company_id", None)
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        return None


async def _get_module(db: AsyncSession, module_id: uuid.UUID) -> StudioModule:
    module = (
        await db.execute(
            select(StudioModule).where(
                StudioModule.id == module_id, StudioModule.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="module_not_found")
    return module


def _audit(
    request: Request,
    actor: uuid.UUID,
    action: str,
    resource_id: uuid.UUID,
    changes: dict[str, Any],
) -> AuditLog:
    """Construit une ligne d'audit (journal immuable) pour une action Studio."""
    return AuditLog(
        company_id=_actor_company_id(request),
        user_id=actor,
        user_email=getattr(request.state, "email", None),
        action=action,
        resource="studio_module",
        resource_id=resource_id,
        changes=changes,
        ip_address=request.client.host if request.client else None,
        user_agent=(request.headers.get("user-agent") or "")[:500] or None,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────


@studio_router.get("/health")
async def studio_health() -> dict[str, str]:
    return {"section": "admin.platform.studio", "status": "ok"}


@studio_router.post("/modules", response_model=ModuleDetailOut, status_code=status.HTTP_201_CREATED)
async def create_module(
    body: ModuleCreate,
    actor: uuid.UUID = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> ModuleDetailOut:
    """Crée un module en brouillon (`draft`). `key` unique (409 si déjà pris)."""
    exists = (
        await db.execute(select(StudioModule.id).where(StudioModule.key == body.key))
    ).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="module_key_taken")

    module = StudioModule(
        key=body.key,
        title_ar=body.title_ar,
        title_en=body.title_en,
        title_fr=body.title_fr,
        flavor=body.flavor,
        mode=body.mode,
        schema_json=body.sheet_schema,
        state="draft",
        created_by=actor,
    )
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return ModuleDetailOut(data=ModuleOut.model_validate(module))


@studio_router.get("/modules", response_model=ModuleListOut)
async def list_modules(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ModuleListOut:
    """Liste les modules conçus (plateforme, tri desc création)."""
    base = select(StudioModule).where(StudioModule.deleted_at.is_(None))
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(StudioModule.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return ModuleListOut(
        data=[ModuleOut.model_validate(m) for m in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@studio_router.get("/modules/{module_id}", response_model=ModuleDetailOut)
async def get_module(
    module_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ModuleDetailOut:
    module = await _get_module(db, module_id)
    return ModuleDetailOut(data=ModuleOut.model_validate(module))


class SchemaOut(BaseModel):
    success: bool = True
    data: SheetSchema | None


@studio_router.post("/modules/{module_id}/schema", response_model=ModuleDetailOut)
async def set_schema(
    module_id: uuid.UUID,
    body: SheetSchema,
    request: Request,
    actor: uuid.UUID = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> ModuleDetailOut:
    """Attache/met à jour le schéma de feuille d'un module lite (donnée, jamais exécutée).

    `body` est validé contre `SheetSchema` (422 si mal formé : type d'élément inconnu,
    action hors liste blanche, slug invalide, tailles dépassées…). Éditable uniquement
    tant que le module est `draft` (gelé après construction). Audit de la modification.
    """
    module = await _get_module(db, module_id)
    if module.state != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="module_not_editable")
    module.schema_json = body.model_dump()
    db.add(
        _audit(
            request,
            actor,
            "studio:schema_set",
            module.id,
            {"sheets": len(body.sheets), "schema_version": body.schema_version},
        )
    )
    await db.commit()
    await db.refresh(module)
    return ModuleDetailOut(data=ModuleOut.model_validate(module))


@studio_router.get("/modules/{module_id}/schema", response_model=SchemaOut)
async def get_schema(
    module_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> SchemaOut:
    """Renvoie le schéma de feuille du module (null s'il n'en a pas encore)."""
    module = await _get_module(db, module_id)
    if module.schema_json is None:
        return SchemaOut(data=None)
    # Re-validation défensive : un schéma stocké reste conforme avant d'être renvoyé.
    return SchemaOut(data=SheetSchema.model_validate(module.schema_json))


@studio_router.post("/modules/{module_id}/build", response_model=ModuleDetailOut)
async def build_module(
    module_id: uuid.UUID,
    request: Request,
    actor: uuid.UUID = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> ModuleDetailOut:
    """Lance le pipeline de construction.

    Phase 0 : **dry-run stubbé** — aucun git/gh/subprocess. Simule le pipeline en
    faisant transiter le module `draft → built → tested → audited` (transitions
    validées par la machine à états) et stocke des rapports RADAR/CHASSEUR factices.
    L'exécution réelle (Phase 3) sera déléguée au worker dédié `worker-studio` derrière
    `STUDIO_CODEGEN_ENABLED` ; tant qu'elle n'existe pas, on refuse l'activation.
    """
    module = await _get_module(db, module_id)
    if module.state != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="module_not_draft")
    if codegen_enabled():
        # Garde-fou honnête : le worker Phase 3 n'existe pas encore.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="codegen_orchestrator_not_implemented",
        )

    # Dry-run : on simule les étapes du pipeline via la machine à états.
    for dst in ("built", "tested", "audited"):
        if not can_transition(module.state, dst):  # garde-fou (ne devrait jamais arriver)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="invalid_transition")
        module.state = dst
    module.radar_report = {"stubbed": True, "note": "dry_run (STUDIO_CODEGEN_ENABLED=false)"}
    module.chasseur_report = {"stubbed": True, "cross_tenant": "n/a (Phase 0)"}
    db.add(_audit(request, actor, "studio:build_dry_run", module.id, {"state": "audited"}))
    await db.commit()
    await db.refresh(module)
    return ModuleDetailOut(data=ModuleOut.model_validate(module))


@studio_router.post(
    "/modules/{module_id}/request-integration",
    response_model=IntegrationRequestDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def request_integration(
    module_id: uuid.UUID,
    body: IntegrationRequestCreate,
    request: Request,
    actor: uuid.UUID = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> IntegrationRequestDetailOut:
    """Admin A demande l'intégration (4-eyes, étape 1). Raison + ticket obligatoires.

    Le module doit être `audited` (lite) ou `pr_open` (code). Crée une demande
    `pending` avec TTL ; refuse s'il existe déjà une demande pending non expirée.
    Trace l'audit + émet une alerte (warning) — la chaîne d'alerte complète est Phase 4.
    """
    module = await _get_module(db, module_id)
    if module.state not in ("audited", "pr_open"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="module_not_ready")

    now = datetime.now(UTC)
    existing = (
        (
            await db.execute(
                select(StudioIntegrationRequest).where(
                    StudioIntegrationRequest.module_id == module.id,
                    StudioIntegrationRequest.status == "pending",
                )
            )
        )
        .scalars()
        .all()
    )
    for req in existing:
        if not is_expired(req.expires_at, now):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="integration_already_pending"
            )
        req.status = "expired"  # nettoie les pending périmées au passage

    intreq = StudioIntegrationRequest(
        module_id=module.id,
        requested_by=actor,
        reason=body.reason,
        ticket_ref=body.ticket_ref,
        status="pending",
        expires_at=now + timedelta(minutes=integration_ttl_minutes()),
    )
    db.add(intreq)
    db.add(
        _audit(
            request,
            actor,
            "studio:integration.requested",
            module.id,
            {"reason": body.reason, "ticket_ref": body.ticket_ref},
        )
    )
    await db.commit()
    await db.refresh(intreq)
    # Alerte (Phase 0 : signal best-effort ; canal d'alerte critique dédié = Phase 4).
    logger.warning(
        "STUDIO 4-eyes: intégration demandée module=%s par=%s ticket=%s",
        module.key,
        actor,
        body.ticket_ref,
    )
    return IntegrationRequestDetailOut(data=IntegrationRequestOut.model_validate(intreq))


@studio_router.post(
    "/modules/{module_id}/approve-integration",
    response_model=IntegrationRequestDetailOut,
)
async def approve_integration(
    module_id: uuid.UUID,
    request: Request,
    actor: uuid.UUID = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> IntegrationRequestDetailOut:
    """Admin B approuve l'intégration (4-eyes, étape 2).

    Garde-fous : l'approbateur doit DIFFÉRER du demandeur (403 `four_eyes_required`) ;
    la demande doit être `pending` et non expirée (409 sinon). Au succès : la demande
    passe `approved`, le module `→ approved → integrated` ; `is_integrated` ne bascule
    que pour le flavor `lite` (le `code` marquera une PR prête en Phase 3, jamais un
    merge). Audit avec les DEUX acteurs (demandeur + approbateur).
    """
    module = await _get_module(db, module_id)
    intreq = (
        (
            await db.execute(
                select(StudioIntegrationRequest)
                .where(
                    StudioIntegrationRequest.module_id == module.id,
                    StudioIntegrationRequest.status == "pending",
                )
                .order_by(StudioIntegrationRequest.created_at.desc())
            )
        )
        .scalars()
        .first()
    )
    if intreq is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no_pending_request")

    now = datetime.now(UTC)
    if is_expired(intreq.expires_at, now):
        intreq.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="integration_request_expired"
        )
    if actor == intreq.requested_by:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="four_eyes_required")

    # Approbation + transition du module (audited|pr_open → approved → integrated).
    intreq.status = "approved"
    intreq.approved_by = actor
    intreq.approved_at = now
    if not can_transition(module.state, "approved"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="invalid_transition")
    module.state = "approved"
    module.state = "integrated"
    module.is_integrated = module.flavor == "lite"
    db.add(
        _audit(
            request,
            actor,
            "studio:integration.approved",
            module.id,
            {
                "requested_by": str(intreq.requested_by),
                "approved_by": str(actor),
                "flavor": module.flavor,
                "is_integrated": module.is_integrated,
            },
        )
    )
    await db.commit()
    await db.refresh(intreq)
    logger.warning(
        "STUDIO 4-eyes: intégration APPROUVÉE module=%s demandeur=%s approbateur=%s",
        module.key,
        intreq.requested_by,
        actor,
    )
    return IntegrationRequestDetailOut(data=IntegrationRequestOut.model_validate(intreq))


@studio_router.get(
    "/modules/{module_id}/integration-requests",
    response_model=IntegrationRequestListOut,
)
async def list_integration_requests(
    module_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> IntegrationRequestListOut:
    """Historique des demandes d'intégration d'un module (tri desc)."""
    await _get_module(db, module_id)  # 404 si module inconnu
    rows = (
        (
            await db.execute(
                select(StudioIntegrationRequest)
                .where(StudioIntegrationRequest.module_id == module_id)
                .order_by(StudioIntegrationRequest.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return IntegrationRequestListOut(
        data=[IntegrationRequestOut.model_validate(r) for r in rows],
        meta={"total": len(rows)},
    )
