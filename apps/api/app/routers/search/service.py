"""Logique de la recherche globale back-office.

Deux couches :
- **helpers purs** (libellés, normalisation, parsing des types) — testables sans DB ;
- **recherche** : Meili si peuplé (tolérance aux fautes), repli DB ILIKE sinon.
Tout est scopé `company_id` (Loi 1) : les requêtes DB filtrent explicitement et
Meili filtre sur `company_id`.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.contract import Contract
from app.models.property import Property
from app.routers.search import meili
from app.routers.search.schemas import ENTITY_TYPES

logger = logging.getLogger(__name__)

# ── Helpers purs ──────────────────────────────────────────────────────────────


def normalize_query(q: str | None) -> str:
    """Trim + compacte les espaces internes. Renvoie '' si vide/None."""
    return " ".join((q or "").split())


def parse_types(types: str | None) -> list[str]:
    """CSV `types=` → liste validée (sous-ensemble d'ENTITY_TYPES). Défaut : tous."""
    if not types:
        return list(ENTITY_TYPES)
    wanted = [t.strip() for t in types.split(",") if t.strip()]
    keep = [t for t in wanted if t in ENTITY_TYPES]
    return keep or list(ENTITY_TYPES)


def client_label(c: Client) -> str:
    """Nom affichable d'un client (société ou personne), repli sur id court."""
    name = (c.company_name or "").strip() or " ".join(
        p for p in [c.first_name, c.last_name] if p
    ).strip()
    return name or f"#{str(c.id)[:8]}"


def client_subtitle(c: Client) -> str | None:
    return (c.email or c.phone or None) if (c.email or c.phone) else None


def property_label(p: Property) -> str:
    """Titre d'un bien (1ʳᵉ langue dispo), repli sur la référence."""
    return (p.title_en or p.title_fr or p.title_ar or "").strip() or p.reference


# ── Recherche DB (repli) ──────────────────────────────────────────────────────


async def _company_id(db: AsyncSession) -> uuid.UUID:
    result = await db.execute(text("SELECT current_setting('app.current_company_id', true)"))
    return uuid.UUID(result.scalar())


async def _db_properties(
    db: AsyncSession, cid: uuid.UUID, q: str, limit: int
) -> list[dict[str, Any]]:
    pat = f"%{q}%"
    rows = (
        (
            await db.execute(
                select(Property)
                .where(
                    Property.company_id == cid,
                    Property.deleted_at.is_(None),
                    or_(
                        Property.reference.ilike(pat),
                        Property.title_en.ilike(pat),
                        Property.title_fr.ilike(pat),
                        Property.title_ar.ilike(pat),
                        Property.city.ilike(pat),
                    ),
                )
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "entity_type": "property",
            "id": str(p.id),
            "label": property_label(p),
            "subtitle": p.city,
            "reference": p.reference,
        }
        for p in rows
    ]


async def _db_clients(db: AsyncSession, cid: uuid.UUID, q: str, limit: int) -> list[dict[str, Any]]:
    pat = f"%{q}%"
    rows = (
        (
            await db.execute(
                select(Client)
                .where(
                    Client.company_id == cid,
                    Client.deleted_at.is_(None),
                    or_(
                        Client.first_name.ilike(pat),
                        Client.last_name.ilike(pat),
                        Client.company_name.ilike(pat),
                        Client.email.ilike(pat),
                        Client.phone.ilike(pat),
                    ),
                )
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "entity_type": "client",
            "id": str(c.id),
            "label": client_label(c),
            "subtitle": client_subtitle(c),
            "reference": None,
        }
        for c in rows
    ]


async def _db_contracts(
    db: AsyncSession, cid: uuid.UUID, q: str, limit: int
) -> list[dict[str, Any]]:
    pat = f"%{q}%"
    rows = (
        (
            await db.execute(
                select(Contract)
                .where(
                    Contract.company_id == cid,
                    Contract.deleted_at.is_(None),
                    Contract.reference.ilike(pat),
                )
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "entity_type": "contract",
            "id": str(k.id),
            "label": k.reference,
            "subtitle": k.status,
            "reference": k.reference,
        }
        for k in rows
    ]


async def db_search(
    db: AsyncSession, cid: uuid.UUID, q: str, types: list[str], limit: int
) -> list[dict[str, Any]]:
    """Recherche DB ILIKE multi-entités, scopée tenant. Per-type limit = `limit`."""
    out: list[dict[str, Any]] = []
    if "property" in types:
        out += await _db_properties(db, cid, q, limit)
    if "client" in types:
        out += await _db_clients(db, cid, q, limit)
    if "contract" in types:
        out += await _db_contracts(db, cid, q, limit)
    return out


# ── Orchestration ─────────────────────────────────────────────────────────────


async def global_search(
    db: AsyncSession, q: str, types_csv: str | None, limit: int = 8
) -> tuple[list[dict[str, Any]], str]:
    """Recherche unifiée. Retourne (hits, source) où source ∈ {meili, db, empty}.

    Tente Meili (tolérance aux fautes) ; en cas d'erreur OU de 0 résultat
    (index pas encore peuplé), repli DB ILIKE. Toujours scopé `company_id`.
    """
    nq = normalize_query(q)
    types = parse_types(types_csv)
    if not nq:
        return [], "empty"
    cid = await _company_id(db)
    try:
        hits = await meili.search(cid, nq, types, limit)
        if hits:
            return hits[: limit * len(types)], "meili"
    except Exception as exc:  # Meili best-effort → repli DB ; on trace pour le debug.
        logger.debug("Meili indisponible, repli DB: %s", exc)
    return await db_search(db, cid, nq, types, limit), "db"


async def collect_docs(db: AsyncSession, cid: uuid.UUID) -> list[dict[str, Any]]:
    """Rassemble tous les documents indexables d'une société (pour reindex)."""
    docs: list[dict[str, Any]] = []
    docs += await _db_properties(db, cid, "", 10_000)
    docs += await _db_clients(db, cid, "", 10_000)
    docs += await _db_contracts(db, cid, "", 10_000)
    return docs
