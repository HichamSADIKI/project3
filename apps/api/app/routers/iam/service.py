"""Service IAM — moteur d'héritage de permissions + fonctions DB.

Ce fichier a deux étages :

1. **Helpers purs (sans DB, testés à fond)** — le moteur `resolve_effective`.
   Deux axes d'héritage résolus de façon déterministe et *fail-closed* :
   - Spécificité RESSOURCE d'abord : on remonte l'arbre du nœud demandé vers la
     racine ; le **premier** niveau portant un grant décide.
   - Précédence SUJET ensuite : à ce niveau, le sujet le plus spécifique gagne
     (user > unité > groupe) ; à précédence égale, **Deny l'emporte**.
   Aucun grant jusqu'à la racine → **deny**.

   Implication (cohérente avec une logique de spécificité, type CSS) : un grant
   plus profond sur la ressource prime un grant plus haut, même venant d'un sujet
   de précédence supérieure. Pour qu'un override utilisateur batte un grant de
   groupe, il doit être posé au **même nœud (ou plus profond)**.

2. **Fonctions DB (async, filtrées company_id)** — ajoutées en Phase 3.
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from typing import Any

import redis.asyncio as aioredis
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.models.user import User, UserRole, UserStatus
from app.routers.iam import catalogue
from app.routers.iam.models import (
    AccessGrant,
    Group,
    GroupMember,
    PermissionNode,
    Unit,
    UnitMember,
)

# Précédence des sujets (le plus spécifique gagne à niveau de ressource égal).
PRECEDENCE: dict[str, int] = {"group": 1, "unit": 2, "user": 3}

ALLOW = "allow"
DENY = "deny"


@dataclass(frozen=True)
class NodeRef:
    """Nœud du catalogue réduit à ce qui compte pour la résolution."""

    key: str
    parent_key: str | None


@dataclass(frozen=True)
class Grant:
    """Un droit : un sujet (type+id) pose `effect` sur un nœud (par sa clé)."""

    subject_type: str  # group|unit|user
    subject_id: str
    node_key: str
    effect: str  # allow|deny


@dataclass(frozen=True)
class Effective:
    """Résultat résolu pour un nœud : effet + ce qui l'a décidé (traçabilité UI)."""

    effect: str  # allow|deny
    source: str  # "group" | "unit" | "user" | "default"
    via_node: str | None  # nœud (ancêtre) qui a porté le grant décisif


def build_parent_map(nodes: list[NodeRef]) -> dict[str, str | None]:
    """clé → clé parente (None pour les racines)."""
    return {n.key: n.parent_key for n in nodes}


def _ancestor_path(node_key: str, parent_map: dict[str, str | None]) -> list[str]:
    """Chemin du nœud vers la racine : [node, parent, …, racine]. Anti-cycle."""
    path: list[str] = []
    seen: set[str] = set()
    cur: str | None = node_key
    while cur is not None and cur not in seen:
        seen.add(cur)
        path.append(cur)
        cur = parent_map.get(cur)
    return path


def subjects_for(
    user_id: str,
    group_ids: list[str],
    units: list[tuple[str, str]],
) -> set[tuple[str, str]]:
    """Construit l'ensemble des sujets d'un utilisateur pour la résolution.

    `units` = liste de (unit_id, parent_group_id) : être membre d'une unité ajoute
    l'unité ET son groupe parent (héritage de sujet), en plus des groupes directs.
    """
    subjects: set[tuple[str, str]] = {("user", user_id)}
    for gid in group_ids:
        subjects.add(("group", gid))
    for unit_id, parent_group_id in units:
        subjects.add(("unit", unit_id))
        subjects.add(("group", parent_group_id))
    return subjects


def resolve_effective(
    nodes: list[NodeRef],
    subjects: set[tuple[str, str]],
    grants: list[Grant],
) -> dict[str, Effective]:
    """Calcule l'effet résolu pour CHAQUE nœud du catalogue.

    Déterministe, fail-closed. Voir l'en-tête du module pour la sémantique.
    """
    parent_map = build_parent_map(nodes)

    # Pré-filtre : seuls les grants des sujets de l'utilisateur comptent.
    # Index node_key → liste de (précédence, effect) pertinents.
    relevant: dict[str, list[tuple[int, str]]] = {}
    for g in grants:
        if (g.subject_type, g.subject_id) not in subjects:
            continue
        relevant.setdefault(g.node_key, []).append((PRECEDENCE.get(g.subject_type, 0), g.effect))

    # Inverse de PRECEDENCE pour retrouver le type du sujet décisif.
    prec_to_type = {v: k for k, v in PRECEDENCE.items()}

    result: dict[str, Effective] = {}
    for node in nodes:
        result[node.key] = _resolve_one(node.key, parent_map, relevant, prec_to_type)
    return result


def _resolve_one(
    node_key: str,
    parent_map: dict[str, str | None],
    relevant: dict[str, list[tuple[int, str]]],
    prec_to_type: dict[int, str],
) -> Effective:
    for ancestor in _ancestor_path(node_key, parent_map):
        entries = relevant.get(ancestor)
        if not entries:
            continue
        # Niveau de ressource décisif : on prend la précédence sujet la plus forte.
        top_prec = max(p for p, _ in entries)
        effects_at_top = {e for p, e in entries if p == top_prec}
        # À précédence égale, Deny l'emporte.
        effect = DENY if DENY in effects_at_top else ALLOW
        return Effective(
            effect=effect,
            source=prec_to_type.get(top_prec, "group"),
            via_node=ancestor,
        )
    return Effective(effect=DENY, source="default", via_node=None)


def allowed_keys(effective: dict[str, Effective]) -> set[str]:
    """Ensemble des clés autorisées — pratique pour le set transmis au frontend."""
    return {k for k, e in effective.items() if e.effect == ALLOW}


def can(effective: dict[str, Effective], node_key: str) -> bool:
    """Vrai si le nœud est autorisé dans la carte résolue (deny/absent = faux)."""
    entry = effective.get(node_key)
    return entry is not None and entry.effect == ALLOW


# ═════════════════════════════════════════════════════════════════════════════════
# Couche DB (async, filtrée company_id — Loi 1). RLS active via get_db_session.
# ═════════════════════════════════════════════════════════════════════════════════


def _valkey_url() -> str:
    return os.getenv("VALKEY_URL", "redis://valkey:6379/0")


# ── Catalogue ────────────────────────────────────────────────────────────────────


async def load_nodes(db: AsyncSession, company_id: uuid.UUID) -> list[PermissionNode]:
    """Nœuds visibles : catalogue système (company_id NULL) + nœuds du tenant.

    La policy RLS de permission_nodes autorise déjà `company_id IS NULL OR = tenant`,
    donc un simple SELECT suffit (pas de filtre explicite nécessaire mais lisible).
    """
    rows = (await db.execute(select(PermissionNode).order_by(PermissionNode.sort_order))).scalars()
    return list(rows)


def page_visibility(
    nodes: list[PermissionNode], effective: dict[str, Effective]
) -> dict[str, list[str]]:
    """Visibilité nav/écran pour le frontend, déduite des nœuds `page`.

    Renvoie les nav_keys/screen_keys *connus* (présents au catalogue, donc à gater)
    et ceux *autorisés* (page allow). Le frontend laisse visibles les entrées de nav
    inconnues (non encore modélisées) et masque les connues non autorisées.
    """
    nav_known: set[str] = set()
    nav_allowed: set[str] = set()
    screen_known: set[str] = set()
    screen_allowed: set[str] = set()
    for n in nodes:
        if n.type != "page":
            continue
        allowed = can(effective, n.key)
        if n.nav_key:
            nav_known.add(n.nav_key)
            if allowed:
                nav_allowed.add(n.nav_key)
        if n.screen_key:
            screen_known.add(n.screen_key)
            if allowed:
                screen_allowed.add(n.screen_key)
    return {
        "nav_known": sorted(nav_known),
        "nav_allowed": sorted(nav_allowed),
        "screen_known": sorted(screen_known),
        "screen_allowed": sorted(screen_allowed),
    }


def _refs_and_maps(
    nodes: list[PermissionNode],
) -> tuple[list[NodeRef], dict[uuid.UUID, str], dict[str, uuid.UUID]]:
    # Reconstruit parent_key depuis parent_id (les nœuds système n'ont pas de doublon de clé).
    id_to_key = {n.id: n.key for n in nodes}
    key_to_id = {n.key: n.id for n in nodes}
    refs = [
        NodeRef(key=n.key, parent_key=id_to_key.get(n.parent_id) if n.parent_id else None)
        for n in nodes
    ]
    return refs, id_to_key, key_to_id


# ── Sujets de l'utilisateur ──────────────────────────────────────────────────────


async def load_user_subjects(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> set[tuple[str, str]]:
    group_ids = [
        str(gid)
        for (gid,) in (
            await db.execute(
                select(GroupMember.group_id).where(
                    GroupMember.company_id == company_id, GroupMember.user_id == user_id
                )
            )
        ).all()
    ]
    unit_rows = (
        await db.execute(
            select(UnitMember.unit_id, Unit.group_id)
            .join(Unit, Unit.id == UnitMember.unit_id)
            .where(UnitMember.company_id == company_id, UnitMember.user_id == user_id)
        )
    ).all()
    units = [(str(uid), str(gid)) for uid, gid in unit_rows]
    return subjects_for(str(user_id), group_ids, units)


async def load_grants(
    db: AsyncSession, company_id: uuid.UUID, id_to_key: dict[uuid.UUID, str]
) -> list[Grant]:
    rows = (
        await db.execute(select(AccessGrant).where(AccessGrant.company_id == company_id))
    ).scalars()
    grants: list[Grant] = []
    for g in rows:
        node_key = id_to_key.get(g.node_id)
        if node_key is None:  # nœud supprimé entre-temps
            continue
        grants.append(Grant(g.subject_type, str(g.subject_id), node_key, g.effect))
    return grants


# ── Résolution effective (+ cache Valkey versionné) ──────────────────────────────


async def compute_effective(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> dict[str, Effective]:
    await ensure_seeded(db, company_id)
    # Auto-réparation de la baseline avant de charger les sujets → l'éventuel
    # rattachement au groupe de rôle est pris en compte dès cette résolution.
    await ensure_role_group_membership(db, company_id, user_id)
    nodes = await load_nodes(db, company_id)
    refs, id_to_key, _ = _refs_and_maps(nodes)
    subjects = await load_user_subjects(db, company_id, user_id)
    grants = await load_grants(db, company_id, id_to_key)
    return resolve_effective(refs, subjects, grants)


async def _company_version(r: aioredis.Redis, company_id: uuid.UUID) -> str:
    ver = await r.get(f"perms:{company_id}:ver")
    return str(ver) if ver else "0"


async def bump_company_version(company_id: uuid.UUID) -> None:
    """Invalide TOUT le cache de permissions du tenant (changement de grant/membership)."""
    try:
        async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
            await r.incr(f"perms:{company_id}:ver")
    except Exception:  # noqa: S110  cache best-effort
        pass


async def get_effective_cached(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> dict[str, Effective]:
    """Set effectif depuis le cache Valkey (TTL 15 min), sinon recalcul + mise en cache.

    Clé versionnée par tenant → `bump_company_version` invalide tout d'un coup, sans scan.
    Dégradation gracieuse si Valkey est indisponible.
    """
    try:
        async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
            ver = await _company_version(r, company_id)
            key = f"perms:{company_id}:{ver}:{user_id}"
            cached = await r.get(key)
            if cached:
                raw = json.loads(cached)
                return {
                    k: Effective(v["effect"], v["source"], v["via_node"]) for k, v in raw.items()
                }
            effective = await compute_effective(db, company_id, user_id)
            await r.set(
                key,
                json.dumps(
                    {
                        k: {"effect": e.effect, "source": e.source, "via_node": e.via_node}
                        for k, e in effective.items()
                    }
                ),
                ex=900,
            )
            return effective
    except Exception:  # noqa: S110  Valkey down → calcul direct
        return await compute_effective(db, company_id, user_id)


# ── Bootstrap paresseux (sociétés créées après la migration 0036) ────────────────


async def ensure_seeded(db: AsyncSession, company_id: uuid.UUID) -> None:
    """Crée les groupes système + grants par défaut si absents (idempotent)."""
    exists = (
        await db.execute(
            select(Group.id)
            .where(Group.company_id == company_id, Group.is_system.is_(True))
            .limit(1)
        )
    ).scalar_one_or_none()
    if exists is not None:
        return
    nodes = await load_nodes(db, company_id)
    _, _, key_to_id = _refs_and_maps(nodes)
    role_to_group: dict[str, uuid.UUID] = {}
    for role in catalogue.SYSTEM_GROUP_ROLES:
        ar, en, fr = catalogue.SYSTEM_GROUP_LABELS[role]
        group = Group(
            id=uuid.uuid4(),
            company_id=company_id,
            slug=f"sys-{role}",
            name_ar=ar,
            name_en=en,
            name_fr=fr,
            is_system=True,
        )
        db.add(group)
        role_to_group[role] = group.id
        grants = catalogue.expand_default_grants(role)
        for effect, keys in (("allow", grants["allow"]), ("deny", grants["deny"])):
            for k in keys:
                nid = key_to_id.get(k)
                if nid is None:
                    continue
                db.add(
                    AccessGrant(
                        id=uuid.uuid4(),
                        company_id=company_id,
                        subject_type="group",
                        subject_id=group.id,
                        node_id=nid,
                        effect=effect,
                        scope="all",
                    )
                )
    # Affecte chaque utilisateur staff existant au groupe système de son rôle
    # (mirroir du bootstrap de migration → l'admin de la société retrouve ses droits).
    users = (
        await db.execute(
            select(User.id, User.role).where(
                User.company_id == company_id, User.deleted_at.is_(None)
            )
        )
    ).all()
    for uid, role in users:
        gid = role_to_group.get(role)
        if gid is not None:
            db.add(GroupMember(group_id=gid, user_id=uid, company_id=company_id))
    await db.commit()


async def ensure_role_group_membership(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    """Auto-réparation : garantit que l'utilisateur staff est membre du groupe
    système de son rôle (baseline RBAC), idempotent. Renvoie True si rattaché.

    `ensure_seeded` n'assigne les utilisateurs **existants** qu'au tout premier
    bootstrap (early-return ensuite) ; un compte créé/seedé plus tard naîtrait
    « aveugle ». Appelé sur le chemin de résolution (`compute_effective`), ce
    correctif rattache chaque compte à sa baseline dès son prochain chargement.
    Rôle non-staff (partner/client → pas de `sys-{role}`) → no-op.
    """
    role = (
        await db.execute(
            select(User.role).where(
                User.id == user_id,
                User.company_id == company_id,
                User.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if role is None:
        return False
    sys_group_id = (
        await db.execute(
            select(Group.id).where(Group.company_id == company_id, Group.slug == f"sys-{role}")
        )
    ).scalar_one_or_none()
    if sys_group_id is None:
        return False
    already = (
        await db.execute(
            select(GroupMember.user_id).where(
                GroupMember.group_id == sys_group_id,
                GroupMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if already is not None:
        return False
    db.add(GroupMember(group_id=sys_group_id, user_id=user_id, company_id=company_id))
    await db.commit()
    return True


# ── CRUD groupes ─────────────────────────────────────────────────────────────────


async def list_groups(db: AsyncSession, company_id: uuid.UUID) -> list[Group]:
    rows = (
        await db.execute(
            select(Group)
            .where(Group.company_id == company_id, Group.deleted_at.is_(None))
            .order_by(Group.is_system.desc(), Group.slug)
        )
    ).scalars()
    return list(rows)


async def get_group(db: AsyncSession, company_id: uuid.UUID, group_id: uuid.UUID) -> Group | None:
    return (
        await db.execute(
            select(Group).where(
                Group.id == group_id,
                Group.company_id == company_id,
                Group.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


async def create_group(db: AsyncSession, company_id: uuid.UUID, data: dict[str, Any]) -> Group:
    group = Group(id=uuid.uuid4(), company_id=company_id, is_system=False, **data)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


async def update_group(db: AsyncSession, group: Group, data: dict[str, Any]) -> Group:
    for field, value in data.items():
        if value is not None:
            setattr(group, field, value)
    await db.commit()
    await db.refresh(group)
    return group


async def soft_delete_group(db: AsyncSession, group: Group) -> None:
    group.deleted_at = func.now()
    await db.commit()


# ── CRUD unités ──────────────────────────────────────────────────────────────────


async def list_units(
    db: AsyncSession, company_id: uuid.UUID, group_id: uuid.UUID | None = None
) -> list[Unit]:
    stmt = select(Unit).where(Unit.company_id == company_id, Unit.deleted_at.is_(None))
    if group_id is not None:
        stmt = stmt.where(Unit.group_id == group_id)
    rows = (await db.execute(stmt.order_by(Unit.created_at))).scalars()
    return list(rows)


async def get_unit(db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID) -> Unit | None:
    return (
        await db.execute(
            select(Unit).where(
                Unit.id == unit_id, Unit.company_id == company_id, Unit.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()


async def create_unit(db: AsyncSession, company_id: uuid.UUID, data: dict[str, Any]) -> Unit:
    unit = Unit(id=uuid.uuid4(), company_id=company_id, **data)
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    return unit


async def update_unit(db: AsyncSession, unit: Unit, data: dict[str, Any]) -> Unit:
    for field, value in data.items():
        if value is not None:
            setattr(unit, field, value)
    await db.commit()
    await db.refresh(unit)
    return unit


async def soft_delete_unit(db: AsyncSession, unit: Unit) -> None:
    unit.deleted_at = func.now()
    await db.commit()


# ── Appartenances ────────────────────────────────────────────────────────────────


async def add_group_member(
    db: AsyncSession, company_id: uuid.UUID, group_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    exists = (
        await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id, GroupMember.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if exists is None:
        db.add(GroupMember(group_id=group_id, user_id=user_id, company_id=company_id))
        await db.commit()
    await bump_company_version(company_id)


async def remove_group_member(
    db: AsyncSession, company_id: uuid.UUID, group_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    await db.execute(
        delete(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    await db.commit()
    await bump_company_version(company_id)


async def add_unit_member(
    db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    exists = (
        await db.execute(
            select(UnitMember).where(UnitMember.unit_id == unit_id, UnitMember.user_id == user_id)
        )
    ).scalar_one_or_none()
    if exists is None:
        db.add(UnitMember(unit_id=unit_id, user_id=user_id, company_id=company_id))
        await db.commit()
    await bump_company_version(company_id)


async def remove_unit_member(
    db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    await db.execute(
        delete(UnitMember).where(UnitMember.unit_id == unit_id, UnitMember.user_id == user_id)
    )
    await db.commit()
    await bump_company_version(company_id)


# ── Grants (matrice) ─────────────────────────────────────────────────────────────


async def get_subject_grants(
    db: AsyncSession, company_id: uuid.UUID, subject_type: str, subject_id: uuid.UUID
) -> list[tuple[str, str, str]]:
    """Retourne [(node_key, effect, scope)] pour un sujet."""
    nodes = await load_nodes(db, company_id)
    _, id_to_key, _ = _refs_and_maps(nodes)
    rows = (
        await db.execute(
            select(AccessGrant).where(
                AccessGrant.company_id == company_id,
                AccessGrant.subject_type == subject_type,
                AccessGrant.subject_id == subject_id,
            )
        )
    ).scalars()
    out: list[tuple[str, str, str]] = []
    for g in rows:
        key = id_to_key.get(g.node_id)
        if key is not None:
            out.append((key, g.effect, g.scope))
    return out


async def replace_subject_grants(
    db: AsyncSession,
    company_id: uuid.UUID,
    subject_type: str,
    subject_id: uuid.UUID,
    items: list[tuple[str, str, str]],
    created_by: uuid.UUID | None,
) -> int:
    """Remplace l'ensemble des grants d'un sujet (upsert en masse depuis la matrice).

    Une clé inconnue est ignorée. Retourne le nombre de grants posés.
    """
    nodes = await load_nodes(db, company_id)
    _, _, key_to_id = _refs_and_maps(nodes)
    await db.execute(
        delete(AccessGrant).where(
            AccessGrant.company_id == company_id,
            AccessGrant.subject_type == subject_type,
            AccessGrant.subject_id == subject_id,
        )
    )
    count = 0
    for node_key, effect, scope in items:
        nid = key_to_id.get(node_key)
        if nid is None:
            continue
        db.add(
            AccessGrant(
                id=uuid.uuid4(),
                company_id=company_id,
                subject_type=subject_type,
                subject_id=subject_id,
                node_id=nid,
                effect=effect,
                scope=scope,
                created_by=created_by,
            )
        )
        count += 1
    await db.commit()
    await bump_company_version(company_id)
    return count


# ── Utilisateurs (CRUD staff interne — comble le manque actuel) ──────────────────


async def user_memberships(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[list[uuid.UUID], list[uuid.UUID]]:
    group_ids = [
        gid
        for (gid,) in (
            await db.execute(
                select(GroupMember.group_id).where(
                    GroupMember.company_id == company_id, GroupMember.user_id == user_id
                )
            )
        ).all()
    ]
    unit_ids = [
        uid
        for (uid,) in (
            await db.execute(
                select(UnitMember.unit_id).where(
                    UnitMember.company_id == company_id, UnitMember.user_id == user_id
                )
            )
        ).all()
    ]
    return group_ids, unit_ids


async def list_users(
    db: AsyncSession, company_id: uuid.UUID, *, page: int, limit: int, search: str | None
) -> tuple[list[User], int]:
    stmt = select(User).where(User.company_id == company_id, User.deleted_at.is_(None))
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(func.lower(User.full_name).like(like) | func.lower(User.email).like(like))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(stmt.order_by(User.full_name).offset((page - 1) * limit).limit(limit))
    ).scalars()
    return list(rows), total


async def get_user(db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID) -> User | None:
    return (
        await db.execute(
            select(User).where(
                User.id == user_id, User.company_id == company_id, User.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()


async def email_taken(db: AsyncSession, email: str) -> bool:
    return (
        await db.execute(select(User.id).where(func.lower(User.email) == email.lower()))
    ).scalar_one_or_none() is not None


async def set_user_memberships(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    group_ids: list[uuid.UUID] | None,
    unit_ids: list[uuid.UUID] | None,
) -> None:
    """Remplace les appartenances de l'utilisateur (seules les entités du tenant comptent)."""
    if group_ids is not None:
        valid = {g.id for g in await list_groups(db, company_id) if g.id in set(group_ids)}
        await db.execute(delete(GroupMember).where(GroupMember.user_id == user_id))
        for gid in valid:
            db.add(GroupMember(group_id=gid, user_id=user_id, company_id=company_id))
    if unit_ids is not None:
        valid_u = {u.id for u in await list_units(db, company_id) if u.id in set(unit_ids)}
        await db.execute(delete(UnitMember).where(UnitMember.user_id == user_id))
        for uid in valid_u:
            db.add(UnitMember(unit_id=uid, user_id=user_id, company_id=company_id))
    await db.commit()
    await bump_company_version(company_id)


async def create_user(db: AsyncSession, company_id: uuid.UUID, data: dict[str, Any]) -> User:
    user = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=data["email"],
        hashed_password=hash_password(data["password"]),
        full_name=data["full_name"],
        role=data.get("role", UserRole.AGENT.value),
        status=UserStatus.ACTIVE.value,
        is_active=True,
        preferred_language=data.get("preferred_language", "en"),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    # Socle : on rattache l'utilisateur au groupe système de son rôle (baseline),
    # en plus des groupes/unités explicitement demandés.
    await ensure_seeded(db, company_id)
    sys_group = (
        await db.execute(
            select(Group.id).where(Group.company_id == company_id, Group.slug == f"sys-{user.role}")
        )
    ).scalar_one_or_none()
    group_ids = list(data.get("group_ids", []))
    if sys_group is not None and sys_group not in group_ids:
        group_ids.append(sys_group)
    await set_user_memberships(db, company_id, user.id, group_ids, data.get("unit_ids", []))
    return user


async def update_user(
    db: AsyncSession, company_id: uuid.UUID, user: User, data: dict[str, Any]
) -> User:
    for field in ("full_name", "role", "preferred_language"):
        if data.get(field) is not None:
            setattr(user, field, data[field])
    if data.get("status") is not None:
        user.status = data["status"]
        user.is_active = data["status"] == UserStatus.ACTIVE.value
    await db.commit()
    if "group_ids" in data or "unit_ids" in data:
        await set_user_memberships(
            db, company_id, user.id, data.get("group_ids"), data.get("unit_ids")
        )
    await db.refresh(user)
    return user
