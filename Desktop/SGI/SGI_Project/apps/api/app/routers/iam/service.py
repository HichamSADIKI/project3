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

from dataclasses import dataclass

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
