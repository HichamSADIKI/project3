"""Tests IAM.

Couche 1 — **helpers purs** (ce fichier, sans DB) : le moteur d'héritage
`resolve_effective` est la brique de confiance du module ; on le teste de façon
exhaustive (cascade, override Deny, union multi-appartenances, précédence
sujet, spécificité ressource, fail-closed).

Couche 2 — endpoints d'intégration (ajoutés en Phase 3, nécessitent Postgres).
"""

from __future__ import annotations

from app.routers.iam import catalogue
from app.routers.iam.service import (
    Grant,
    NodeRef,
    can,
    resolve_effective,
    subjects_for,
)

# ── Mini-catalogue de test (arbre ressources) ───────────────────────────────────
#   realestate
#   ├─ realestate.contracts
#   │  └─ realestate.contracts.delete
#   ├─ realestate.payments
#   │  ├─ realestate.payments.delete
#   │  └─ realestate.payments.read
#   crm
#   finance
NODES = [
    NodeRef("realestate", None),
    NodeRef("realestate.contracts", "realestate"),
    NodeRef("realestate.contracts.delete", "realestate.contracts"),
    NodeRef("realestate.payments", "realestate"),
    NodeRef("realestate.payments.delete", "realestate.payments"),
    NodeRef("realestate.payments.read", "realestate.payments"),
    NodeRef("crm", None),
    NodeRef("finance", None),
]

G1 = "11111111-1111-1111-1111-111111111111"  # groupe
G2 = "22222222-2222-2222-2222-222222222222"  # groupe
U1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"  # unité (parent G1)
USER = "99999999-9999-9999-9999-999999999999"


def _resolve(subjects: set[tuple[str, str]], grants: list[Grant]):
    return resolve_effective(NODES, subjects, grants)


# ── Cascade descendante ─────────────────────────────────────────────────────────


def test_cascade_allow_on_category_propagates_to_all_descendants():
    subjects = subjects_for(USER, [G1], [])
    grants = [Grant("group", G1, "realestate", "allow")]
    eff = _resolve(subjects, grants)
    for key in (
        "realestate",
        "realestate.contracts",
        "realestate.contracts.delete",
        "realestate.payments",
        "realestate.payments.delete",
    ):
        assert can(eff, key), key
    # Les autres catégories restent fermées (fail-closed).
    assert not can(eff, "crm")
    assert not can(eff, "finance")


# ── Override Deny plus spécifique ────────────────────────────────────────────────


def test_specific_deny_overrides_broad_allow():
    subjects = subjects_for(USER, [G1], [])
    grants = [
        Grant("group", G1, "realestate", "allow"),
        Grant("group", G1, "realestate.payments.delete", "deny"),
    ]
    eff = _resolve(subjects, grants)
    assert can(eff, "realestate.payments")  # voisin autorisé
    assert can(eff, "realestate.contracts.delete")  # autre branche autorisée
    assert not can(eff, "realestate.payments.delete")  # exception déniée


def test_specific_allow_overrides_broad_deny():
    subjects = subjects_for(USER, [G1], [])
    grants = [
        Grant("group", G1, "realestate", "deny"),
        Grant("group", G1, "realestate.payments.read", "allow"),
    ]
    eff = _resolve(subjects, grants)
    assert not can(eff, "realestate")
    assert not can(eff, "realestate.payments.delete")
    assert can(eff, "realestate.payments.read")  # ré-autorisé précisément


# ── Précédence des sujets (à niveau de ressource égal) ───────────────────────────


def test_user_override_beats_group_at_same_node():
    subjects = subjects_for(USER, [G1], [])
    grants = [
        Grant("group", G1, "realestate.payments", "allow"),
        Grant("user", USER, "realestate.payments", "deny"),
    ]
    eff = _resolve(subjects, grants)
    assert not can(eff, "realestate.payments")
    assert eff["realestate.payments"].source == "user"


def test_unit_beats_group_at_same_node():
    # user dans l'unité U1 (parent G1) → sujets {user, unit U1, group G1}.
    subjects = subjects_for(USER, [], [(U1, G1)])
    grants = [
        Grant("group", G1, "realestate", "deny"),
        Grant("unit", U1, "realestate", "allow"),
    ]
    eff = _resolve(subjects, grants)
    assert can(eff, "realestate")
    assert eff["realestate"].source == "unit"


def test_deny_wins_at_equal_precedence():
    # Deux groupes au même nœud : un allow, un deny → deny gagne.
    subjects = subjects_for(USER, [G1, G2], [])
    grants = [
        Grant("group", G1, "realestate.contracts", "allow"),
        Grant("group", G2, "realestate.contracts", "deny"),
    ]
    eff = _resolve(subjects, grants)
    assert not can(eff, "realestate.contracts")


# ── Spécificité ressource prime la précédence sujet ─────────────────────────────


def test_resource_specificity_outranks_subject_precedence():
    # user deny la catégorie, mais le groupe autorise un nœud plus profond :
    # le grant plus spécifique sur la ressource décide (allow).
    subjects = subjects_for(USER, [G1], [])
    grants = [
        Grant("user", USER, "realestate", "deny"),
        Grant("group", G1, "realestate.contracts.delete", "allow"),
    ]
    eff = _resolve(subjects, grants)
    assert not can(eff, "realestate")
    assert not can(eff, "realestate.payments")
    assert can(eff, "realestate.contracts.delete")  # plus spécifique → l'emporte


# ── Union multi-appartenances ────────────────────────────────────────────────────


def test_union_of_multiple_memberships():
    # user dans G1 (realestate) et G2 (finance) → les deux branches autorisées.
    subjects = subjects_for(USER, [G1, G2], [])
    grants = [
        Grant("group", G1, "realestate", "allow"),
        Grant("group", G2, "finance", "allow"),
    ]
    eff = _resolve(subjects, grants)
    assert can(eff, "realestate.contracts")
    assert can(eff, "finance")
    assert not can(eff, "crm")


def test_grants_of_other_subjects_are_ignored():
    # Un grant d'un groupe dont l'utilisateur n'est PAS membre ne s'applique pas.
    subjects = subjects_for(USER, [G1], [])
    grants = [Grant("group", G2, "realestate", "allow")]  # G2 ≠ sujets de l'user
    eff = _resolve(subjects, grants)
    assert not can(eff, "realestate")


# ── Fail-closed ──────────────────────────────────────────────────────────────────


def test_no_grants_is_deny_everywhere():
    subjects = subjects_for(USER, [G1], [])
    eff = _resolve(subjects, [])
    assert all(not can(eff, n.key) for n in NODES)
    assert eff["realestate"].source == "default"


def test_unit_membership_inherits_parent_group_grant():
    # user seulement dans l'unité U1 (parent G1) ; le grant est sur G1.
    subjects = subjects_for(USER, [], [(U1, G1)])
    grants = [Grant("group", G1, "realestate", "allow")]
    eff = _resolve(subjects, grants)
    assert can(eff, "realestate.payments")
    assert eff["realestate.payments"].source == "group"


# ── Catalogue réel : cohérence des grants par défaut des rôles ───────────────────


def test_default_role_grants_admin_allows_everything():
    nodes_full = [NodeRef(n["key"], n["parent_key"]) for n in catalogue.build_catalogue()]
    grants = []
    g_admin = "admin-group"
    expanded = catalogue.expand_default_grants("admin")
    for k in expanded["allow"]:
        grants.append(Grant("group", g_admin, k, "allow"))
    for k in expanded["deny"]:
        grants.append(Grant("group", g_admin, k, "deny"))
    eff = resolve_effective(nodes_full, {("group", g_admin)}, grants)
    # L'admin voit la gestion des accès et peut supprimer des paiements.
    assert can(eff, "settings.access")
    assert can(eff, "realestate.payments.delete")


def test_default_role_grants_agent_cannot_delete_nor_access_settings():
    nodes_full = [NodeRef(n["key"], n["parent_key"]) for n in catalogue.build_catalogue()]
    grants = []
    g_agent = "agent-group"
    expanded = catalogue.expand_default_grants("agent")
    for k in expanded["allow"]:
        grants.append(Grant("group", g_agent, k, "allow"))
    for k in expanded["deny"]:
        grants.append(Grant("group", g_agent, k, "deny"))
    eff = resolve_effective(nodes_full, {("group", g_agent)}, grants)
    assert can(eff, "realestate.contracts.create")  # métier autorisé
    assert not can(eff, "realestate.contracts.delete")  # suppression déniée
    assert not can(eff, "settings.access")  # gestion des accès interdite
    assert not can(eff, "finance.overview")  # finance hors périmètre agent
