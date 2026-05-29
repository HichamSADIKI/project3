"""Export tasks — génération asynchrone de PDF (contrats), CSV/XLSX (rapports).

Stub minimal : aucun PDF généré ici, juste les hooks attendus par le
routing Celery (queue 'exports'). À implémenter avec WeasyPrint / Jinja2.
"""
from __future__ import annotations

import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.exports.generate_contract_pdf", queue="exports")
def generate_contract_pdf(*, contract_id: str) -> dict:
    """Génère le PDF d'un contrat de bail/vente. À implémenter."""
    logger.info("generate_contract_pdf stub", extra={"contract_id": contract_id})
    return {"status": "noop", "contract_id": contract_id}


@celery_app.task(name="app.tasks.exports.export_clients_xlsx", queue="exports")
def export_clients_xlsx(*, company_id: str, filters: dict) -> dict:
    """Export XLSX du catalogue clients filtré. À implémenter."""
    logger.info("export_clients_xlsx stub", extra={"company_id": company_id})
    return {"status": "noop", "company_id": company_id}
