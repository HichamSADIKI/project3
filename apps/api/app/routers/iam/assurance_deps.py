"""Step-up par niveau d'assurance — « UAE Infinity PASS » (Brique 3a).

Rend le niveau d'assurance (L0–L3) **actionnable** dans les endpoints : une
dépendance FastAPI ``require_assurance(action)`` garde une action sensible
derrière le niveau minimum requis (ex. signer ⇒ L2, IBAN/paiement ⇒ L3), en
réutilisant le socle pur ``app.core.assurance`` + la persistance (Brique 2).

N'altère **pas** l'auth existante (JWT/RBAC) : c'est une garde *complémentaire*
(preuve d'identité), à composer avec ``require_roles`` (rôle) et la RLS (société).
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.assurance import can_perform, min_level_for
from app.core.deps import get_db_session
from app.core.route_deps import get_company_id
from app.routers.iam.assurance_service import get_assurance


async def current_assurance_level(
    db: AsyncSession,
    company_id: uuid.UUID,
    subject_id: uuid.UUID,
    subject_type: str = "user",
) -> str:
    """Niveau d'assurance courant d'une identité (``L0`` si aucun enregistrement)."""
    record = await get_assurance(db, company_id, subject_type, subject_id)
    return record.level if record is not None else "L0"


async def assert_assurance(
    db: AsyncSession,
    company_id: uuid.UUID,
    subject_id: uuid.UUID,
    action: str,
    subject_type: str = "user",
) -> str:
    """Vérifie que l'identité a le niveau requis pour ``action`` ; sinon 403.

    Renvoie le niveau courant si suffisant. Le 403 porte le niveau requis pour
    permettre au client de proposer une montée d'assurance (step-up)."""
    level = await current_assurance_level(db, company_id, subject_id, subject_type)
    if not can_perform(level, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "assurance_step_up_required",
                "action": action,
                "current_level": level,
                "required_level": min_level_for(action),
            },
        )
    return level


def require_assurance(
    action: str, subject_type: str = "user"
) -> Callable[[Request, AsyncSession], Awaitable[str]]:
    """Fabrique une dépendance FastAPI gardant ``action`` par niveau d'assurance.

    Usage : ``dependencies=[Depends(require_assurance("sign_document"))]`` ou en
    paramètre pour récupérer le niveau. Cible l'utilisateur authentifié
    (``request.state.user_id``, ``subject_type="user"``)."""

    async def _dep(request: Request, db: AsyncSession = Depends(get_db_session)) -> str:
        company_id = await get_company_id(db)
        raw_uid = getattr(request.state, "user_id", None)
        if not raw_uid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthenticated")
        return await assert_assurance(db, company_id, uuid.UUID(raw_uid), action, subject_type)

    return _dep
