"""Service présence — heartbeat (upsert + géo) + sessions actives + agrégations.

Tout est filtré `company_id` (RLS via get_db_session). La géo de l'IP est résolue
localement (PDPL-safe) ; on ne ré-résout que si l'IP change ou si la géo manque.
"""

from __future__ import annotations

import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import geoip
from app.models.user import User
from app.routers.presence.models import PresenceSession

ACTIVE_WINDOW_SECONDS = 60


async def heartbeat(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    session_key: str,
    ip: str | None,
    user_agent: str | None,
    category: str | None,
    subcategory: str | None,
    page: str | None,
) -> None:
    """Crée/met à jour la session (par company_id + session_key)."""
    row = (
        await db.execute(
            select(PresenceSession).where(
                PresenceSession.company_id == company_id,
                PresenceSession.session_key == session_key,
            )
        )
    ).scalar_one_or_none()

    if row is None:
        row = PresenceSession(company_id=company_id, session_key=session_key)
        db.add(row)

    # Ne (re)résout la géo que si l'IP a changé ou que la géo manque (évite N appels).
    if ip and (row.ip != ip or row.geo_lat is None):
        geo = geoip.resolve(ip)
        row.geo_country = geo["country"]
        row.geo_city = geo["city"]
        row.geo_lat = geo["lat"]
        row.geo_lng = geo["lng"]

    row.user_id = user_id
    row.ip = ip
    row.user_agent = (user_agent or "")[:500] or None
    row.category = category
    row.subcategory = subcategory
    row.page = page
    row.last_seen_at = datetime.now(UTC)
    await db.commit()


async def active_sessions(
    db: AsyncSession, company_id: uuid.UUID, window_seconds: int = ACTIVE_WINDOW_SECONDS
) -> list[tuple[PresenceSession, str | None]]:
    """Sessions vues dans la fenêtre, avec un libellé utilisateur (nom ou email)."""
    cutoff = datetime.now(UTC) - timedelta(seconds=window_seconds)
    rows = (
        await db.execute(
            select(PresenceSession, User.full_name, User.email)
            .outerjoin(User, User.id == PresenceSession.user_id)
            .where(
                PresenceSession.company_id == company_id,
                PresenceSession.last_seen_at >= cutoff,
            )
            .order_by(PresenceSession.last_seen_at.desc())
        )
    ).all()
    return [(sess, full_name or email) for (sess, full_name, email) in rows]


def count_by(items: list[tuple[str | None, str | None]]) -> list[dict[str, object]]:
    """Agrège (clé, libellé) → [{key, label, count}] trié par count décroissant.

    Les clés None/vides sont regroupées sous '∅' (inconnu). Pur, testable.
    """
    counts: Counter[str] = Counter()
    labels: dict[str, str | None] = {}
    for key, label in items:
        k = key or "∅"
        counts[k] += 1
        if k not in labels:
            labels[k] = label
    return [
        {"key": k, "label": labels.get(k), "count": c}
        for k, c in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ]
