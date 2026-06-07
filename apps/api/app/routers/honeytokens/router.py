"""Router public (SANS JWT) — déclenchement (*trip*) d'un honeytoken.

L'endpoint *trip* est ce qu'un attaquant atteint en utilisant un leurre (faux
secret/URL planté). Il déclenche l'alerte EN FOND et renvoie une **réponse neutre
constante** (404 générique) quel que soit le résultat : aucun oracle ne révèle qu'un
piège existe, qu'un token est valide, ou à quelle société il appartient.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.routers.honeytokens import service

router = APIRouter(prefix="/honeytokens", tags=["honeytokens"])


@router.get("/trip/{token}")
async def trip_endpoint(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Réponse neutre constante (404). Déclenche l'alerte en fond si le leurre matche."""
    ip = request.client.host if request.client else None
    request_id = getattr(request.state, "request_id", None)
    try:
        await service.trip_honeytoken(db, token, ip=ip, request_id=request_id)
    except Exception:  # noqa: BLE001, S110  le trip ne doit jamais révéler d'erreur
        pass
    # Toujours 404 « Not Found » — indistinguable d'une URL quelconque inexistante.
    raise HTTPException(status_code=404, detail="Not Found")
