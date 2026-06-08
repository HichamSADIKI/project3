"""Résolveur géo-IP **self-hosted** (PDPL : aucun appel réseau externe).

Utilise une base MaxMind GeoLite2 City locale (`.mmdb`) via la lib `geoip2`, si
elle est déployée et pointée par la variable d'env `GEOIP_DB_PATH`.

**Dégradation gracieuse** : base/lib absente, IP privée ou non résoluble → tous les
champs à None (jamais d'exception). La feature reste fonctionnelle sans géoloc (la
carte n'affiche alors que les sessions géolocalisables).

Pour activer la géoloc en prod : déposer GeoLite2-City.mmdb, poser `GEOIP_DB_PATH`,
et installer `geoip2` (dépendance optionnelle).
"""

from __future__ import annotations

import functools
import os
from typing import Any

_EMPTY: dict[str, Any] = {"country": None, "city": None, "lat": None, "lng": None}


@functools.lru_cache(maxsize=1)
def _reader() -> Any | None:
    path = os.getenv("GEOIP_DB_PATH", "")
    if not path or not os.path.exists(path):
        return None
    try:
        import geoip2.database  # type: ignore[import-not-found]

        return geoip2.database.Reader(path)
    except Exception:  # noqa: BLE001  lib absente / base illisible → géoloc désactivée
        return None


def resolve(ip: str | None) -> dict[str, Any]:
    """Résout une IP en {country, city, lat, lng}. Jamais d'exception (fallback None)."""
    if not ip:
        return dict(_EMPTY)
    reader = _reader()
    if reader is None:
        return dict(_EMPTY)
    try:
        resp = reader.city(ip)
        return {
            "country": resp.country.iso_code,
            "city": resp.city.name,
            "lat": resp.location.latitude,
            "lng": resp.location.longitude,
        }
    except Exception:  # noqa: BLE001  IP privée/inconnue → pas de géoloc
        return dict(_EMPTY)
