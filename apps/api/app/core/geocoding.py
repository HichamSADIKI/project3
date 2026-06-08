"""Géocodage d'adresse → coordonnées (Google Maps Geocoding API).

Loi 2 : géocoder **une fois** à la création d'un bien et stocker le point PostGIS.
Fail-secure : toute erreur, absence de clé ou résultat vide → ``None`` (la création
du bien n'est jamais bloquée ; le bien reste simplement sans localisation).
"""

from typing import Any

import httpx

from app.core.config import settings

_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
_TIMEOUT_S = 5.0


def parse_geocode_response(data: dict[str, Any]) -> tuple[float, float] | None:
    """Extrait ``(lat, lng)`` du 1er résultat. Pur et testable.

    Renvoie ``None`` si le statut n'est pas ``OK``, s'il n'y a aucun résultat, ou
    si les coordonnées sont absentes/non numériques.
    """
    if data.get("status") != "OK":
        return None
    results = data.get("results") or []
    if not results:
        return None
    loc = results[0].get("geometry", {}).get("location", {})
    lat = loc.get("lat")
    lng = loc.get("lng")
    if not isinstance(lat, int | float) or not isinstance(lng, int | float):
        return None
    if isinstance(lat, bool) or isinstance(lng, bool):
        return None
    return (float(lat), float(lng))


def build_query(*parts: str | None) -> str:
    """Assemble une requête d'adresse à partir de fragments non vides (+ UAE)."""
    fragments = [p.strip() for p in parts if p and p.strip()]
    if not fragments:
        return ""
    if "uae" not in fragments[-1].lower():
        fragments.append("UAE")
    return ", ".join(fragments)


async def geocode(query: str) -> tuple[float, float] | None:
    """Géocode une adresse libre via Google Maps. ``None`` si pas de clé / erreur."""
    q = query.strip()
    if not q or not settings.GOOGLE_MAPS_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            resp = await client.get(
                _GEOCODE_URL,
                params={"address": q, "key": settings.GOOGLE_MAPS_API_KEY},
            )
            resp.raise_for_status()
            return parse_geocode_response(resp.json())
    except Exception:
        # Fail-secure : un géocodage indisponible ne doit jamais bloquer la création.
        return None
