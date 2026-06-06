"""Connecteurs STUBS déterministes (social, portail) + registre par canal.

Les métriques sont dérivées d'un hash de l'id campagne → reproductibles, sans
appel réseau ni aléatoire. Remplacer par un vrai SDK pour passer en production.
"""

from __future__ import annotations

import hashlib
import uuid

from app.routers.marketing.connectors.base import PublishConnector, PublishResult


def _seed(campaign_id: uuid.UUID) -> int:
    """Entier déterministe dérivé de l'id campagne (pas d'aléatoire)."""
    return int(hashlib.sha256(campaign_id.bytes).hexdigest()[:8], 16)


class _StubConnector(PublishConnector):
    channel_prefix = "stub"

    def publish(
        self, campaign_id: uuid.UUID, reference: str, unit_ids: list[uuid.UUID]
    ) -> PublishResult:
        seed = _seed(campaign_id)
        n_units = max(1, len(unit_ids))
        impressions = (seed % 900 + 100) * n_units  # 100..999 par unité
        clicks = impressions // (5 + (seed % 6))  # ~6-9 % de CTR déterministe
        return PublishResult(
            external_ref=f"{self.channel_prefix}:{reference}:{seed:08x}",
            impressions=impressions,
            clicks=clicks,
        )


class SocialStubConnector(_StubConnector):
    channel_prefix = "social"


class PortalFeedStubConnector(_StubConnector):
    channel_prefix = "portal"


class EmailStubConnector(_StubConnector):
    channel_prefix = "email"


_SOCIAL = SocialStubConnector()
_PORTAL = PortalFeedStubConnector()
_EMAIL = EmailStubConnector()
_DEFAULT = _StubConnector()


def get_connector(channel: str) -> PublishConnector:
    """Mappe un canal vers son connecteur stub (jamais d'erreur : fallback _DEFAULT)."""
    if channel.startswith("social_"):
        return _SOCIAL
    if channel.startswith("portal_"):
        return _PORTAL
    if channel == "email":
        return _EMAIL
    return _DEFAULT
