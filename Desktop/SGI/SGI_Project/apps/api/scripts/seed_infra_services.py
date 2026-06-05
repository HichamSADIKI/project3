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

# (name == job Prometheus, kind, description, is_controllable)
# is_controllable=True : cible des actions start/stop/restart de Phase 3.
_SERVICES: list[tuple[str, str, str, bool]] = [
    ("sgi-api", "api", "API FastAPI (scrapée up{job=sgi-api})", True),
    ("postgres", "db", "PostgreSQL 17 + PostGIS (pas d'exporter en Phase 1)", True),
    ("valkey", "cache", "Valkey 8 — cache & broker Celery", True),
    ("minio", "storage", "MinIO — stockage objets (médias/contrats)", True),
    ("nginx", "proxy", "Nginx — reverse proxy / TLS", True),
    ("node-exporter", "exporter", "node-exporter — métriques hôte", False),
    ("cadvisor", "exporter", "cAdvisor — métriques conteneurs", False),
    ("prometheus", "monitoring", "Prometheus — collecte des métriques", False),
    ("grafana", "monitoring", "Grafana — dashboards (pas d'exporter)", False),
]


async def main() -> None:
    created = 0
    async with async_session_maker() as db:
        for name, kind, description, controllable in _SERVICES:
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
                )
            )
            created += 1
        await db.commit()
    skipped = len(_SERVICES) - created
    print(f"seed_infra_services: {created} créé(s), {skipped} déjà présent(s).")


if __name__ == "__main__":
    asyncio.run(main())
