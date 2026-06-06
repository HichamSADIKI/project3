"""Connecteur API externe — STUB configurable, sans URL ni secret en dur.

Aucun appel réseau réel : retourne les enregistrements fournis (mode démo). Une
implémentation réelle lirait l'URL/clé depuis `settings`/env si présentes, sinon
resterait en mode stub. À brancher après validation des intégrations (doc P8).
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.routers.sources.connectors.base import SourceConnector


class ApiStubConnector(SourceConnector):
    """Stub d'appel API portail — `records` injectés, aucun réseau réel."""

    source_type = "other"

    def __init__(
        self,
        *,
        records: list[dict[str, Any]] | None = None,
        channel: str = "portal",
        source_type: str = "other",
    ) -> None:
        self._records = records or []
        self.source_channel = f"api:{channel}"
        self.source_type = source_type

    def fetch(self) -> Iterable[dict[str, Any]]:
        # Aucun appel réseau : on retourne tel quel les enregistrements de démo.
        return list(self._records)
