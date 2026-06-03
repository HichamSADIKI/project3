"""Connecteurs de source — ABC + implémentations stub (CSV / webhook / API).

Aucun appel réseau réel par défaut, aucun secret en dur. Les connecteurs
produisent des enregistrements bruts (`dict`) ingérés ensuite par
`sources.service.ingest_record`.
"""

from app.routers.sources.connectors.api_connector import ApiStubConnector
from app.routers.sources.connectors.base import SourceConnector
from app.routers.sources.connectors.csv_connector import CsvConnector
from app.routers.sources.connectors.webhook_connector import WebhookConnector

__all__ = ["ApiStubConnector", "CsvConnector", "SourceConnector", "WebhookConnector"]
