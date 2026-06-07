"""Router admin (AUTHENTIFIÉ) — gestion des honeytokens d'une société.

`get_db_session` arme la RLS sur le tenant du JWT ⇒ Loi 1 garantie (aucune société
ne lit/écrit les leurres d'une autre). Toutes les routes exigent admin/manager : la
liste expose les tokens-secrets, donc lecture comprise.

Routes (préfixe `/api/v1/admin/honeytokens`) :
- `GET    ""            ` — liste des leurres de la société (avec token).
- `POST   ""            ` — crée un leurre (token signé généré côté serveur).
- `DELETE /{honeytoken_id}` — soft-delete + désactivation.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.honeytokens import service
from app.routers.honeytokens.schemas import (
    HoneytokenCreate,
    HoneytokenEnvelope,
    HoneytokenListEnvelope,
    HoneytokenOut,
)

router = APIRouter(prefix="/admin/honeytokens", tags=["honeytokens_admin"])

_ADMIN_ROLES = ("admin", "manager")


def require_admin(request: Request) -> uuid.UUID:
    """401 si non authentifié, 403 si rôle insuffisant. Retourne le company_id (JWT)."""
    raw = getattr(request.state, "company_id", None)
    role = getattr(request.state, "role", None)
    if not raw or role is None:
        raise HTTPException(status_code=401, detail="authentication_required")
    if role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="insufficient_permissions")
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        # company_id présent mais malformé → échec d'auth (401), jamais 500.
        raise HTTPException(status_code=401, detail="invalid_tenant_context") from exc


@router.get("", response_model=HoneytokenListEnvelope)
async def list_honeytokens_endpoint(
    company_id: uuid.UUID = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> HoneytokenListEnvelope:
    rows = await service.list_honeytokens(db, company_id)
    return HoneytokenListEnvelope(data=[HoneytokenOut.model_validate(r) for r in rows])


@router.post("", response_model=HoneytokenEnvelope, status_code=status.HTTP_201_CREATED)
async def create_honeytoken_endpoint(
    body: HoneytokenCreate,
    company_id: uuid.UUID = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> HoneytokenEnvelope:
    row = await service.create_honeytoken(db, company_id, kind=body.kind, label=body.label)
    return HoneytokenEnvelope(data=HoneytokenOut.model_validate(row))


@router.delete("/{honeytoken_id}")
async def delete_honeytoken_endpoint(
    honeytoken_id: uuid.UUID,
    company_id: uuid.UUID = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    ok = await service.delete_honeytoken(db, company_id, honeytoken_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not_found")
    return {"success": True}
