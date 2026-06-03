"""Watcher de portails immobiliers — tâche Celery beat (DÉSACTIVÉE par défaut).

Surveille des pages de portails (Bayut / PropertyFinder / Dubizzle / autres) et
ingère les biens trouvés comme enregistrements de provenance via
`sources.service.ingest_record`. Conçu pour rester SÛR en production :

- **Désactivé par défaut** : ne fait rien tant que `settings.WATCHER_ENABLED` est
  faux (activation après validation légale des cibles — doc P3 / robots.txt).
- **Aucune URL en dur** : les cibles sont lues depuis `settings.WATCHER_TARGETS`
  (JSON `[{"company_id": "...", "source_type": "other", "channel": "bayut",
  "urls": ["https://..."]}]`).
- **curl_cffi SYNC uniquement** : pas de Playwright (le browser singleton du
  lifespan FastAPI n'existe PAS dans le worker Celery).
- **Engine éphémère NullPool par exécution** (rôle privilégié `sgi_user` via
  `DATABASE_URL`) : on n'utilise PAS l'`async_session_maker` GLOBAL — son pool
  asyncpg partagé serait lié à un event loop différent, provoquant l'erreur
  « <Future> attached to a different loop » quand un worker Celery réutilise le
  process sur des tâches successives (cf. database.py:20-35). On crée donc un
  engine `NullPool` local, dans le loop ouvert par `asyncio.run`, disposé en fin
  de tâche. Le GUC RLS est posé manuellement par tenant car aucun middleware
  tenant n'intervient ici.
- **Délai poli entre fetchs** (anti-bot, `settings.WATCHER_FETCH_DELAY_S`).

Réutilise les parsers HTML existants (`scraping/parsers.py`). Idempotence : la
clé `external_id` (URL) évite les doublons à chaque exécution.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from app.core.config import settings
from app.routers.scraping.parsers import (
    parse_bayut_html,
    parse_dubizzle_html,
    parse_propertyfinder_html,
)
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

_FETCH_TIMEOUT = 20
# Schémas autorisés pour les cibles (anti-SSRF : refuse file://, gopher://, etc.).
_ALLOWED_SCHEMES = frozenset({"http", "https"})


def _parse_targets() -> list[dict[str, Any]]:
    """Parse `settings.WATCHER_TARGETS` (JSON). Liste vide si absent/invalide."""
    raw = (settings.WATCHER_TARGETS or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("WATCHER_TARGETS JSON invalide : %s", exc)
        return []
    if not isinstance(parsed, list):
        logger.error("WATCHER_TARGETS doit être une liste JSON")
        return []
    return [t for t in parsed if isinstance(t, dict)]


def _parse_html_for_channel(html: str, channel: str | None) -> dict[str, Any]:
    """Aiguille vers le parser adapté au portail (réutilise scraping/parsers)."""
    ch = (channel or "").lower()
    if "bayut" in ch:
        return parse_bayut_html(html)
    if "propertyfinder" in ch or "property_finder" in ch:
        return parse_propertyfinder_html(html)
    if "dubizzle" in ch:
        return parse_dubizzle_html(html)
    # Repli générique : PropertyFinder couvre le fallback JSON-LD/meta.
    return parse_propertyfinder_html(html)


def _fetch_sync(url: str) -> str | None:
    """Fetch HTML via curl_cffi SYNC (sans browser). None si échec.

    Valide le schéma (anti-SSRF) avant tout appel réseau : seules les cibles
    http(s) sont acceptées (refuse file://, ftp://, gopher://…).
    """
    from urllib.parse import urlparse

    scheme = urlparse(url).scheme.lower()
    if scheme not in _ALLOWED_SCHEMES:
        logger.warning("watcher: schéma non autorisé pour %r — ignoré", url)
        return None
    try:
        from curl_cffi import requests as cffi_requests  # type: ignore[import]
    except ImportError:  # pragma: no cover - dépendance présente en prod
        logger.error("curl_cffi indisponible — watcher inopérant")
        return None
    try:
        session = cffi_requests.Session(impersonate="chrome124")
        resp = session.get(url, timeout=_FETCH_TIMEOUT)
        if resp.status_code not in (200, 301, 302):
            logger.warning("watcher fetch %s → HTTP %s", url, resp.status_code)
            return None
        return resp.text
    except Exception as exc:  # noqa: BLE001
        logger.warning("watcher fetch %s a échoué : %s", url, exc)
        return None


async def _ingest_targets(targets: list[dict[str, Any]]) -> dict[str, int]:
    """Boucle async : pose le GUC RLS par tenant puis ingère via le service.

    Ouvre un engine éphémère `NullPool` (rôle privilégié `sgi_user`) lié au loop
    courant — JAMAIS l'`async_session_maker` global, dont le pool partagé est lié
    à un autre event loop (erreur « <Future> attached to a different loop » sur
    réutilisation du process Celery, cf. database.py:20-35). Le GUC est posé
    manuellement par tenant car aucun middleware tenant n'intervient ici.
    """
    import asyncio

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.routers.sources import service

    summary = {"fetched": 0, "imported": 0, "duplicates": 0, "rejected": 0}
    delay = max(0.0, float(getattr(settings, "WATCHER_FETCH_DELAY_S", 0.0) or 0.0))

    # Engine éphémère, connexions créées et fermées dans CE loop uniquement.
    eng = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    try:
        for target in targets:
            raw_company = target.get("company_id")
            urls = target.get("urls") or []
            if not raw_company or not urls:
                continue
            try:
                company_id = uuid.UUID(str(raw_company))
            except (ValueError, TypeError):
                logger.error("watcher: company_id invalide %r", raw_company)
                continue
            source_type = target.get("source_type", "other")
            channel = target.get("channel")
            source_channel = f"watcher:{channel}" if channel else "watcher"

            async with AsyncSession(eng, expire_on_commit=False) as db:
                # GUC tenant pour la RLS (posé manuellement, portée session).
                await db.execute(
                    text("SELECT set_config('app.current_company_id', :cid, false)"),
                    {"cid": str(company_id)},
                )
                for idx, url in enumerate(urls):
                    if idx > 0 and delay > 0:
                        # Délai poli entre fetchs (anti-bot / rate-limit).
                        await asyncio.sleep(delay)
                    html = _fetch_sync(url)
                    if html is None:
                        continue
                    summary["fetched"] += 1
                    parsed = _parse_html_for_channel(html, channel)
                    # Provenance : URL = external_id (idempotence à chaque run).
                    _record, outcome = await service.ingest_record(
                        db,
                        company_id,
                        source_type=source_type,
                        source_channel=source_channel,
                        external_id=url,
                        raw={"url": url, "parsed": parsed},
                    )
                    if outcome == "imported":
                        summary["imported"] += 1
                    elif outcome == "duplicate":
                        summary["duplicates"] += 1
                    else:
                        summary["rejected"] += 1
    finally:
        await eng.dispose()

    return summary


@celery_app.task(name="app.tasks.watcher.run_property_watch", queue="reminders")
def run_property_watch() -> dict[str, Any]:
    """Scanne les cibles configurées et ingère les biens trouvés (provenance).

    No-op si `WATCHER_ENABLED` est faux (défaut) ou si aucune cible n'est
    configurée. Ne lève jamais — journalise et retourne un résumé.
    """
    if not settings.WATCHER_ENABLED:
        logger.info("run_property_watch : désactivé (WATCHER_ENABLED=false)")
        return {"status": "disabled", "fetched": 0}

    targets = _parse_targets()
    if not targets:
        logger.info("run_property_watch : aucune cible (WATCHER_TARGETS vide)")
        return {"status": "no_targets", "fetched": 0}

    import asyncio

    try:
        summary = asyncio.run(_ingest_targets(targets))
        logger.info("run_property_watch terminé : %s", summary)
        return {"status": "ok", **summary}
    except Exception as exc:  # noqa: BLE001
        logger.error("run_property_watch a échoué : %s", exc)
        return {"status": "error", "error": str(exc)}
