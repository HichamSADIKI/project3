"""Connecteur CSV — parse un contenu CSV en lignes (dict) prêtes à ingérer.

Stub déterministe : ne fait aucun I/O réseau. Accepte soit un contenu CSV texte,
soit une liste de lignes déjà parsées (pass-through).
"""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable
from typing import Any

from app.routers.sources.connectors.base import SourceConnector


class CsvConnector(SourceConnector):
    """Parse un CSV (DictReader) — `source_type` configurable par l'appelant."""

    source_channel = "csv"

    def __init__(
        self,
        *,
        content: str | None = None,
        rows: list[dict[str, Any]] | None = None,
        source_type: str = "existing_customer",
    ) -> None:
        self._content = content
        self._rows = rows
        self.source_type = source_type

    def fetch(self) -> Iterable[dict[str, Any]]:
        if self._rows is not None:
            return list(self._rows)
        if not self._content:
            return []
        reader = csv.DictReader(io.StringIO(self._content))
        return [dict(row) for row in reader]
