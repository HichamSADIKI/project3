"""Router Agenda (Real Estate) — /api/v1/agenda.

Sous-catégorie de la zone Real Estate. Expose la configuration de l'agenda
Google Calendar (source + URL d'embed) lue côté serveur. Pas de table : c'est
de la config globale (env), pas une ressource métier multi-tenant.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.config import settings
from app.core.route_deps import require_roles

from .schemas import AgendaConfigOut
from .service import build_embed_url, is_configured, normalize_lang

router = APIRouter(prefix="/agenda", tags=["agenda"])


@router.get("/config", response_model=AgendaConfigOut)
async def agenda_config(
    lang: str = Query("ar", description="Langue UI : ar | en | fr."),
    _: None = Depends(require_roles("admin", "manager", "agent", "legal", "accounting")),
) -> AgendaConfigOut:
    """Renvoie la configuration de l'agenda Google Calendar.

    `configured=false` si `GOOGLE_CALENDAR_SRC` n'est pas renseigné : le
    frontend affiche alors son aide de configuration.
    """
    src = settings.GOOGLE_CALENDAR_SRC
    tz = settings.AGENDA_TIMEZONE
    resolved_lang = normalize_lang(lang)
    return AgendaConfigOut(
        configured=is_configured(src),
        source=src or None,
        embed_url=build_embed_url(src, timezone=tz, lang=resolved_lang),
        timezone=tz,
        language=resolved_lang,
    )
