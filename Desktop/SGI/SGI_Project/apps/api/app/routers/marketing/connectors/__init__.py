"""Connecteurs de publication marketing (STUBS).

Aucun appel réseau réel, aucun secret en dur : les connecteurs simulent la
publication sur un canal et renvoient un identifiant externe + des métriques
déterministes (pour la démo). Brancher un vrai SDK = remplacer le stub.
"""

from app.routers.marketing.connectors.base import PublishConnector, PublishResult
from app.routers.marketing.connectors.stubs import get_connector

__all__ = ["PublishConnector", "PublishResult", "get_connector"]
