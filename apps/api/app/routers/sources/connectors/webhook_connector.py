"""Connecteur webhook — mappe un payload social inbound en enregistrement brut.

Stub déterministe : aucun I/O réseau. Le payload (déjà reçu et validé en amont)
est normalisé vers la forme attendue par `service.map_to_lead_payload`.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.routers.sources.connectors.base import SourceConnector


class WebhookConnector(SourceConnector):
    """Adapte un payload webhook (Facebook/Instagram/WhatsApp lead form…)."""

    source_type = "social"

    def __init__(self, payload: dict[str, Any], *, channel: str = "facebook") -> None:
        self._payload = payload
        self.source_channel = f"webhook:{channel}"

    def fetch(self) -> Iterable[dict[str, Any]]:
        p = self._payload
        _raw_contact = p.get("contact")
        contact: dict[str, Any] = _raw_contact if isinstance(_raw_contact, dict) else p
        return [
            {
                "external_id": p.get("external_id") or p.get("id"),
                "contact": {
                    "name": contact.get("name") or contact.get("full_name"),
                    "email": contact.get("email"),
                    "phone": contact.get("phone") or contact.get("mobile"),
                },
                "message": p.get("message") or p.get("text"),
                "property_type": p.get("property_type"),
                "location": p.get("location"),
            }
        ]
