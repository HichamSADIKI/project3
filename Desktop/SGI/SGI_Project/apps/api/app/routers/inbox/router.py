"""Router FastAPI — Omnichannel Inbox.

Socle Ph0-1 : health + dépendances partagées. Les endpoints métier (liste,
détail, réponse, assign, tags, notes, webhook, WS) sont ajoutés en Ph2-4.
"""

import uuid

from fastapi import APIRouter, HTTPException, Request, status

router = APIRouter(prefix="/inbox", tags=["inbox"])


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "inbox", "status": "ok"}
