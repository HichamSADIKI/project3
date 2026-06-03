"""ABC `SourceConnector` — interface commune des connecteurs de source.

Un connecteur sait `fetch()` une suite d'enregistrements bruts (`dict`) et porte
son `source_type` (aligné sur `service.SOURCE_TYPES`). La transformation en
`CRMLead` + dédup + idempotence est faite par `service.ingest_record`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import Any


class SourceConnector(ABC):
    """Interface d'un connecteur de source d'ingestion."""

    #: Catégorie de source (cf. service.SOURCE_TYPES).
    source_type: str = "other"
    #: Canal précis (ex. 'csv', 'webhook:facebook', 'api:portal').
    source_channel: str | None = None

    @abstractmethod
    def fetch(self) -> Iterable[dict[str, Any]]:
        """Retourne les enregistrements bruts à ingérer (aucun effet de bord DB)."""
        raise NotImplementedError
