"""Seed — registre des services supervisés (Admin Console · infra-admin).

Peuple la table `infra_services` (PLATEFORME, cross-tenant, sans company_id) lue par
`GET /api/v1/admin/platform/servers`. Idempotent (clé = `name`).

⚠️ Le `name` doit correspondre au label `job` de Prometheus pour que l'état live
(`up{job="<name>"}`) fonctionne. Les jobs réellement scrapés par la stack monitoring
(`infra/monitoring/prometheus/prometheus.yml`, PR #172) sont : sgi-api, node-exporter,
cadvisor, prometheus. Les autres services (db, valkey, minio, nginx, grafana) sont
inventoriés ici mais resteront en état « inconnu » tant qu'aucun exporter ne les scrape
(Phase 2). L'écran gère ce cas (live_state null).

Lancer : docker compose exec -e PYTHONPATH=/app api uv run python scripts/seed_infra_services.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.admin import InfraService

# (name == job Prometheus, kind, description, is_controllable, compose_service)
#
# ⚠️ ALLOWLIST DE CONTRÔLE (D2) — is_controllable=True UNIQUEMENT pour les services
# sûrs à redémarrer. `api`/`db`/`valkey`/`minio` sont DÉLIBÉRÉMENT exclus (redémarrer
# l'API/la DB depuis l'API serait dangereux/auto-destructeur) ; à traiter à part plus
# tard si besoin. `compose_service` = label com.docker.compose.service (résolution du
# conteneur par l'exécuteur). None pour les services du compose monitoring séparé.
_SERVICES: list[tuple[str, str, str, bool, str | None]] = [
    ("sgi-api", "api", "API FastAPI (scrapée up{job=sgi-api})", False, "api"),
    ("postgres", "db", "PostgreSQL 17 + PostGIS", False, "db"),
    ("valkey", "cache", "Valkey 8 — cache & broker Celery", False, "valkey"),
    ("minio", "storage", "MinIO — stockage objets (médias/contrats)", False, "minio"),
    ("meilisearch", "search", "Meilisearch — recherche", True, "meilisearch"),
    ("nginx", "proxy", "Nginx — reverse proxy / TLS", True, "nginx"),
    ("asterisk", "telephony", "Asterisk — centre de contact WebRTC", True, "asterisk"),
    ("node-exporter", "exporter", "node-exporter — métriques hôte", False, None),
    ("cadvisor", "exporter", "cAdvisor — métriques conteneurs", False, None),
    ("prometheus", "monitoring", "Prometheus — collecte des métriques", False, None),
    ("grafana", "monitoring", "Grafana — dashboards", False, None),
]


async def main() -> None:
    created = 0
    async with async_session_maker() as db:
        for name, kind, description, controllable, compose_service in _SERVICES:
            exists = (
                await db.execute(select(InfraService.id).where(InfraService.name == name))
            ).scalar_one_or_none()
            if exists is not None:
                continue
            db.add(
                InfraService(
                    name=name,
                    kind=kind,
                    description=description,
                    is_controllable=controllable,
                    compose_service=compose_service,
                )
            )
            created += 1
        await db.commit()
    skipped = len(_SERVICES) - created
    print(f"seed_infra_services: {created} créé(s), {skipped} déjà présent(s).")


if __name__ == "__main__":
    asyncio.run(main())
