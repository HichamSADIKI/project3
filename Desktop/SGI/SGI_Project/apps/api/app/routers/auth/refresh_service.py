"""Service refresh token — rotation one-time-use + détection de réutilisation.

Séparé de `service.py` (authentification mot de passe) pour rester focalisé.

Modèle de sécurité :
- Le secret est un jeton opaque aléatoire (256 bits) ; **seul son SHA-256 est
  persisté** (`refresh_tokens.token_hash`). Le clair n'existe qu'en transit.
- À chaque `rotate`, l'ancien jeton est révoqué et chaîné (`replaced_by_id`) vers
  son successeur, qui hérite du même `family_id` (= la session).
- Si un jeton déjà révoqué/tourné est rejoué (vol probable), **toute la famille
  est révoquée** (`reuse_detected`) — l'attaquant et la victime sont déconnectés.

Les helpers purs (`generate_token`, `hash_token`, `is_expired`, `is_active`) sont
testables sans base. Les fonctions `issue/rotate/revoke` prennent une `AsyncSession`.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.refresh_token import RefreshToken


class RefreshError(Exception):
    """Erreur de refresh typée. `code` ∈ {invalid_refresh, expired_refresh,
    reuse_detected}."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# ─── Helpers purs (sans DB) ──────────────────────────────────────────────────


def generate_token() -> str:
    """Secret opaque URL-safe de 256 bits — jamais persisté en clair."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 hex (64 car.). Déterministe → permet le lookup par hash."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def refresh_lifetime() -> timedelta:
    return timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)


def is_expired(rt: RefreshToken, now: datetime | None = None) -> bool:
    return (now or _now()) >= rt.expires_at


def is_active(rt: RefreshToken, now: datetime | None = None) -> bool:
    """Actif = ni révoqué ni expiré."""
    return rt.revoked_at is None and not is_expired(rt, now)


# ─── Opérations DB ───────────────────────────────────────────────────────────


async def issue_refresh(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    family_id: uuid.UUID | None = None,
) -> tuple[RefreshToken, str]:
    """Émet un nouveau refresh token pour `user_id`.

    `family_id=None` → nouvelle session (login/mfa). Sinon on poursuit la chaîne
    de rotation existante. Retourne (modèle, **secret en clair**) ; le clair doit
    être renvoyé au client et n'est jamais relu depuis la base.
    """
    plain = generate_token()
    rt = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(plain),
        family_id=family_id or uuid.uuid4(),
        expires_at=_now() + refresh_lifetime(),
    )
    db.add(rt)
    await db.flush()
    return rt, plain


async def _get_by_token(db: AsyncSession, plain: str) -> RefreshToken | None:
    res = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(plain)))
    return res.scalar_one_or_none()


async def revoke_family(db: AsyncSession, family_id: uuid.UUID) -> int:
    """Révoque tous les tokens encore actifs d'une famille. Retourne le nombre
    de lignes révoquées."""
    res = await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    # `db.execute(update(...))` est typé `Result[Any]` mais renvoie en réalité un
    # CursorResult (DML) qui porte `rowcount` — cast pour satisfaire mypy.
    return cast(CursorResult[Any], res).rowcount or 0


async def rotate_refresh(db: AsyncSession, plain: str) -> tuple[RefreshToken, str]:
    """Valide puis fait tourner un refresh token (one-time-use).

    Lève `RefreshError` :
    - `invalid_refresh`  : inconnu en base
    - `reuse_detected`   : déjà révoqué/tourné → rejeu ⇒ révocation de la famille
    - `expired_refresh`  : dépassé sa date d'expiration
    """
    rt = await _get_by_token(db, plain)
    if rt is None:
        raise RefreshError("invalid_refresh")

    # Rejeu d'un token déjà consommé (rotation) ou révoqué (logout) → attaque
    # probable : on coupe toute la session.
    if rt.revoked_at is not None:
        await revoke_family(db, rt.family_id)
        await db.commit()
        raise RefreshError("reuse_detected")

    if is_expired(rt):
        raise RefreshError("expired_refresh")

    new_rt, plain_new = await issue_refresh(db, rt.user_id, family_id=rt.family_id)
    rt.revoked_at = _now()
    rt.replaced_by_id = new_rt.id
    await db.commit()
    return new_rt, plain_new


async def revoke_refresh(db: AsyncSession, plain: str) -> bool:
    """Révoque un token précis (logout). Retourne True si un token actif a été
    révoqué, False sinon (inconnu ou déjà inactif). Idempotent."""
    rt = await _get_by_token(db, plain)
    if rt is None or rt.revoked_at is not None:
        return False
    rt.revoked_at = _now()
    await db.commit()
    return True
