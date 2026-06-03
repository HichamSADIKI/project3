"""Contrat commun des connecteurs de publication."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class PublishResult:
    """Résultat d'une publication : id externe + métriques initiales simulées."""

    external_ref: str
    impressions: int
    clicks: int


class PublishConnector(ABC):
    """Interface d'un canal de diffusion. Implémentations = stubs déterministes."""

    channel_prefix: str = "stub"

    @abstractmethod
    def publish(
        self, campaign_id: uuid.UUID, reference: str, unit_ids: list[uuid.UUID]
    ) -> PublishResult:
        """Publie la campagne sur le canal et renvoie un PublishResult déterministe."""
        raise NotImplementedError
