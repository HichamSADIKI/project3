"""Service honeytokens.

- **Helpers purs** (sans DB) : génération/parse d'un jeton leurre **signé** (la
  `company_id` est embarquée + signée HMAC) + rédaction pour l'audit.
- **CRUD tenant-scopé** (F3) : create / list / delete (soft), filtrés `company_id`.
- **Trip** (F4) : `trip_honeytoken` résout la société depuis le token signé (aucun
  lookup global hors RLS), pose le GUC tenant, lit le leurre **sous RLS**, incrémente,
  crée un `AlertEvent` **critique** (lazy-ensure d'une `AlertRule`) et journalise
  l'accès (audit best-effort, token redacté).

Loi 1 : tout accès DB reste filtré `company_id` + RLS. Le token signé empêche de
forger un déclenchement pour une autre société (HMAC SECRET_KEY).
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.admin import AlertEvent, AlertRule
from app.routers.honeytokens.models import Honeytoken

# GUC tenant — identique au pattern public_site (pose manuelle hors middleware).
_SET_TENANT = text("SELECT set_config('app.current_company_id', :cid, false)")

# Métrique de la règle d'alerte dédiée aux honeytokens (une par société, lazy).
_HONEYTOKEN_METRIC = "honeytoken_access"


# ─────────────────────────────────────────────────────────────────────────
# F2 — helpers purs : jeton leurre signé (company_id embarquée + HMAC)
# ─────────────────────────────────────────────────────────────────────────

_NONCE_BYTES = 24


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _sign(body: str) -> str:
    mac = hmac.new(settings.SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest()
    return _b64(mac)


def generate_token(company_id: uuid.UUID) -> str:
    """Jeton leurre `payload.nonce.hmac` (~99 car). La `company_id` est embarquée
    et signée : impossible de forger un déclenchement pour une autre société."""
    payload = _b64(company_id.bytes)
    nonce = secrets.token_urlsafe(_NONCE_BYTES)
    body = f"{payload}.{nonce}"
    return f"{body}.{_sign(body)}"


def parse_token(token: str | None) -> uuid.UUID | None:
    """Vérifie la signature et extrait la `company_id`. None si invalide/forgé."""
    if not token:
        return None
    try:
        payload, nonce, sig = token.split(".")
    except ValueError:
        return None
    if not hmac.compare_digest(sig, _sign(f"{payload}.{nonce}")):
        return None
    try:
        raw = base64.urlsafe_b64decode(payload + "==")
        return uuid.UUID(bytes=raw)
    except (binascii.Error, ValueError):
        return None


def redact(token: str | None) -> str:
    """Masque un token pour l'audit : 4 premiers caractères + longueur (jamais le secret)."""
    if not token:
        return "∅"
    return f"{token[:4]}…({len(token)})"


# ─────────────────────────────────────────────────────────────────────────
# F3 — CRUD tenant-scopé (RLS armée par get_db_session ; company_id du JWT)
# ─────────────────────────────────────────────────────────────────────────


async def create_honeytoken(
    db: AsyncSession, company_id: uuid.UUID, *, kind: str, label: str
) -> Honeytoken:
    """Crée un leurre (token signé généré côté serveur)."""
    row = Honeytoken(
        company_id=company_id,
        kind=kind,
        label=label,
        token=generate_token(company_id),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_honeytokens(db: AsyncSession, company_id: uuid.UUID) -> list[Honeytoken]:
    """Leurres actifs (non supprimés) de la société, du plus récent au plus ancien."""
    return list(
        (
            await db.execute(
                select(Honeytoken)
                .where(
                    Honeytoken.company_id == company_id,
                    Honeytoken.deleted_at.is_(None),
                )
                .order_by(Honeytoken.created_at.desc())
            )
        )
        .scalars()
        .all()
    )


async def delete_honeytoken(
    db: AsyncSession, company_id: uuid.UUID, honeytoken_id: uuid.UUID
) -> bool:
    """Soft-delete + désactivation. True si trouvé (et supprimé), False sinon."""
    row = (
        await db.execute(
            select(Honeytoken).where(
                Honeytoken.id == honeytoken_id,
                Honeytoken.company_id == company_id,
                Honeytoken.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    row.is_active = False
    row.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


# ─────────────────────────────────────────────────────────────────────────
# F4 — trip : déclenchement → alerte critique + audit
# ─────────────────────────────────────────────────────────────────────────


async def _ensure_honeytoken_rule(db: AsyncSession, company_id: uuid.UUID) -> AlertRule:
    """Règle d'alerte 'honeytoken_access' (critique) de la société — créée à la volée."""
    rule = (
        await db.execute(
            select(AlertRule).where(
                AlertRule.company_id == company_id,
                AlertRule.metric == _HONEYTOKEN_METRIC,
                AlertRule.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if rule is None:
        rule = AlertRule(
            company_id=company_id,
            name="Honeytoken accédé",
            metric=_HONEYTOKEN_METRIC,
            comparator="gte",
            threshold=Decimal(1),
            window_seconds=0,
            severity="critical",
            is_active=True,
        )
        db.add(rule)
        await db.flush()
    return rule


def _audit_trip(
    company_id: uuid.UUID,
    honeytoken_id: uuid.UUID,
    token: str,
    ip: str | None,
    request_id: str | None,
) -> None:
    """Journalise l'accès (best-effort, token redacté). Ne casse jamais le trip."""
    try:
        from app.tasks.audit import write_audit_log

        write_audit_log.delay(
            company_id=str(company_id),
            action="honeytoken:access",
            resource="honeytokens",
            resource_id=str(honeytoken_id),
            ip_address=ip,
            request_id=request_id,
            changes={"token": {"new": redact(token)}},
        )
    except Exception:  # noqa: BLE001, S110  audit best-effort — jamais bloquant
        pass


async def trip_honeytoken(
    db: AsyncSession,
    token: str,
    *,
    ip: str | None = None,
    request_id: str | None = None,
) -> bool:
    """Déclenche un honeytoken. True si un leurre actif a matché (alerte créée).

    Résout la société depuis le token SIGNÉ (aucun lookup global hors RLS), pose le
    GUC tenant, lit le leurre **sous RLS**, incrémente, crée un AlertEvent critique
    et journalise. Token invalide/forgé/inconnu/désactivé → False (réponse neutre).

    RISQUE ACCEPTÉ (oracle de timing) : un token au format invalide repart sans
    requête DB (échec HMAC immédiat), alors qu'un token bien signé déclenche une
    lecture DB — d'où une différence de latence observable. NON exploitable :
    produire un token bien signé exige `SECRET_KEY` (qu'un attaquant n'a pas), donc
    l'oracle ne révèle que « ce token est-il signé par nous », ce qui requiert déjà
    la clé. On n'ajoute donc pas de délai artificiel (complexité/latence pour un
    gain nul). Voir docs/architecture/security-core.md (Axe 7 — déception).
    """
    company_id = parse_token(token)
    if company_id is None:
        return False

    await db.execute(_SET_TENANT, {"cid": str(company_id)})
    try:
        row = (
            await db.execute(
                select(Honeytoken).where(
                    Honeytoken.token == token,
                    Honeytoken.is_active.is_(True),
                    Honeytoken.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if row is None:
            return False

        row.trigger_count += 1
        row.last_triggered_at = datetime.now(UTC)
        rule = await _ensure_honeytoken_rule(db, company_id)
        db.add(
            AlertEvent(
                company_id=company_id,
                rule_id=rule.id,
                observed_value=Decimal(row.trigger_count),
                status="open",
            )
        )
        await db.commit()
        _audit_trip(company_id, row.id, token, ip, request_id)
        return True
    finally:
        # Efface le GUC (fail-closed) — la connexion peut retourner au pool.
        await db.execute(_SET_TENANT, {"cid": ""})
        await db.commit()
