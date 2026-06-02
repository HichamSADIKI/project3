"""Router FastAPI — Ticketing SLA.

Socle Ph0-1 : health + dépendances partagées. Les endpoints métier (liste,
détail+timeline, create, assign, transition, commentaire) arrivent en Ph2.
"""

import uuid

from fastapi import APIRouter, HTTPException, Request, status

router = APIRouter(prefix="/tickets", tags=["ticketing"])


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "ticketing", "status": "ok"}
