"""Module Sources — couche d'ingestion multi-source → leads CRM.

Ingère des enregistrements provenant de sources hétérogènes (contrats, réseaux
sociaux, base client existante, watcher de portails…) et les transforme en
`CRMLead` existants (PAS de table leads parallèle). La table `source_imports`
sert de registre d'idempotence / provenance / journal des rejets.

Suit le pattern router/schemas/service/test, filtré par `company_id` (Loi 1).
"""

from app.routers.sources.router import router

__all__ = ["router"]
