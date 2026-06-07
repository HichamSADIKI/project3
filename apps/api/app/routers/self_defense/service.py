"""Service Self-Defense — config (codes hashés), validation + verrouillage serveur.

- Codes stockés **hashés** (bcrypt via `hash_password`) ; jamais en clair, jamais renvoyés.
- `verify_code` valide armer/désarmer et gère le **verrouillage par utilisateur**
  (compteur d'échecs, lock à `max_attempts`, reset au succès). Si aucun code n'est
  défini pour l'action → action autorisée (non protégée) sans compter d'échec.
- Tout est filtré `company_id` (RLS active via `get_db_session`).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password, verify_password
from app.routers.self_defense.models import SelfDefenseConfig, SelfDefenseLockout

DEFAULT_MAX_ATTEMPTS = 3
Purpose = Literal["arm", "disarm"]


async def get_config(db: AsyncSession, company_id: uuid.UUID) -> SelfDefenseConfig | None:
    return (
        await db.execute(
            select(SelfDefenseConfig).where(SelfDefenseConfig.company_id == company_id)
        )
    ).scalar_one_or_none()


async def _get_or_create_config(db: AsyncSession, company_id: uuid.UUID) -> SelfDefenseConfig:
    row = await get_config(db, company_id)
    if row is None:
        row = SelfDefenseConfig(company_id=company_id)
        db.add(row)
        await db.flush()
    return row


async def update_config(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    arm_code: str | None = None,
    disarm_code: str | None = None,
    max_attempts: int | None = None,
    armgate_enabled: bool | None = None,
    options: dict[str, Any] | None = None,
) -> SelfDefenseConfig:
    """Met à jour la config. Un code vide/absent = inchangé (on ne le réinitialise pas)."""
    row = await _get_or_create_config(db, company_id)
    if arm_code:
        row.arm_code_hash = hash_password(arm_code)
    if disarm_code:
        row.disarm_code_hash = hash_password(disarm_code)
    if max_attempts is not None:
        row.max_attempts = max_attempts
    if armgate_enabled is not None:
        row.armgate_enabled = armgate_enabled
    if options is not None:
        row.options = options
    await db.commit()
    await db.refresh(row)
    return row


async def _get_or_create_lockout(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> SelfDefenseLockout:
    row = (
        await db.execute(
            select(SelfDefenseLockout).where(
                SelfDefenseLockout.company_id == company_id,
                SelfDefenseLockout.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = SelfDefenseLockout(company_id=company_id, user_id=user_id)
        db.add(row)
        await db.flush()
    return row


async def verify_code(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    purpose: Purpose,
    code: str,
) -> dict[str, Any]:
    """Valide le code pour `purpose`. Renvoie {ok, locked, attempts_left}.

    Verrouillage serveur : N échecs (`max_attempts`) → `locked` (déverrouillage admin).
    """
    config = await get_config(db, company_id)
    max_attempts = config.max_attempts if config else DEFAULT_MAX_ATTEMPTS
    lock = await _get_or_create_lockout(db, company_id, user_id)

    if lock.locked:
        await db.commit()
        return {"ok": False, "locked": True, "attempts_left": 0}

    target_hash = None
    if config is not None:
        target_hash = config.arm_code_hash if purpose == "arm" else config.disarm_code_hash

    # Aucun code défini pour cette action → non protégée : autorisé, sans compter d'échec.
    if not target_hash:
        await db.commit()
        return {"ok": True, "locked": False, "attempts_left": max_attempts}

    if verify_password(code, target_hash):
        lock.failed_attempts = 0
        lock.locked = False
        await db.commit()
        return {"ok": True, "locked": False, "attempts_left": max_attempts}

    lock.failed_attempts += 1
    lock.last_failed_at = datetime.now(UTC)
    if lock.failed_attempts >= max_attempts:
        lock.locked = True
        lock.locked_at = datetime.now(UTC)
    await db.commit()
    return {
        "ok": False,
        "locked": lock.locked,
        "attempts_left": max(0, max_attempts - lock.failed_attempts),
    }


async def list_lockouts(db: AsyncSession, company_id: uuid.UUID) -> list[SelfDefenseLockout]:
    """Utilisateurs actuellement verrouillés de la société."""
    return list(
        (
            await db.execute(
                select(SelfDefenseLockout)
                .where(
                    SelfDefenseLockout.company_id == company_id,
                    SelfDefenseLockout.locked.is_(True),
                )
                .order_by(SelfDefenseLockout.locked_at.desc())
            )
        )
        .scalars()
        .all()
    )


async def unlock_user(db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Déverrouille un utilisateur (reset compteur). True si trouvé."""
    row = (
        await db.execute(
            select(SelfDefenseLockout).where(
                SelfDefenseLockout.company_id == company_id,
                SelfDefenseLockout.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    row.locked = False
    row.failed_attempts = 0
    row.locked_at = None
    await db.commit()
    return True
