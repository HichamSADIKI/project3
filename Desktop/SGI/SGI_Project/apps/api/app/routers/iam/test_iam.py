"""Tests IAM.

Couche 1 — **helpers purs** (ce fichier, sans DB) : le moteur d'héritage
`resolve_effective` est la brique de confiance du module ; on le teste de façon
exhaustive (cascade, override Deny, union multi-appartenances, précédence
sujet, spécificité ressource, fail-closed).

Couche 2 — endpoints d'intégration (ajoutés en Phase 3, nécessitent Postgres).
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from app.core.auth import encode_jwt
from app.models.user import User
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


# ═════════════════════════════════════════════════════════════════════════════════
# Couche 2 — endpoints d'intégration (nécessitent Postgres : lancer en conteneur).
# ═════════════════════════════════════════════════════════════════════════════════

_H = "/api/v1/iam"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_health_is_public(client: AsyncClient) -> None:
    r = await client.get(f"{_H}/health")
    assert r.status_code == 200


async def test_admin_me_permissions_has_settings_access(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    r = await client.get(f"{_H}/me/permissions", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    allowed = set(body["allowed"])
    # Le bootstrap paresseux a rattaché l'admin au groupe système → tout autorisé.
    assert "settings.access.read" in allowed
    assert "realestate.payments.delete" in allowed
    # Identité de l'utilisateur courant (salutation du hub / footer sidebar).
    assert body["full_name"] == admin.full_name
    assert body["email"] == admin.email


async def test_catalogue_returns_system_tree(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.get(f"{_H}/catalogue", headers=_auth(token))
    assert r.status_code == 200
    keys = {n["key"] for n in r.json()["data"]}
    assert "settings.access" in keys
    assert "realestate.contracts.delete" in keys


async def test_group_and_unit_crud(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    rg = await client.post(
        f"{_H}/groups", headers=_auth(token), json={"slug": "compta", "name_fr": "Comptabilité"}
    )
    assert rg.status_code == 201
    group_id = rg.json()["data"]["id"]
    ru = await client.post(
        f"{_H}/units",
        headers=_auth(token),
        json={"group_id": group_id, "name_fr": "Caissière"},
    )
    assert ru.status_code == 201
    # La liste des groupes contient le nouveau + les groupes système.
    rl = await client.get(f"{_H}/groups", headers=_auth(token))
    slugs = {g["slug"] for g in rl.json()["data"]}
    assert "compta" in slugs and "sys-admin" in slugs


async def test_unit_parent_group_must_be_in_tenant(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.post(
        f"{_H}/units",
        headers=_auth(token),
        json={"group_id": str(uuid.uuid4()), "name_fr": "X"},
    )
    assert r.status_code == 400


async def test_user_grant_overrides_effective(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    # Crée un agent (reçoit le socle sys-agent → realestate autorisé).
    ru = await client.post(
        f"{_H}/users",
        headers=_auth(token),
        json={
            "email": f"agent-{uuid.uuid4().hex[:8]}@infinity.ae",
            "full_name": "Agent X",
            "password": "AgentPass!23",
            "role": "agent",
        },
    )
    assert ru.status_code == 201
    user_id = ru.json()["data"]["id"]
    # Baseline : l'agent peut créer un contrat.
    eff0 = await client.get(f"{_H}/users/{user_id}/effective", headers=_auth(token))
    assert "realestate.contracts.create" in set(eff0.json()["allowed"])
    # Override utilisateur : deny sur la page contrats → la création est coupée.
    rp = await client.put(
        f"{_H}/grants",
        headers=_auth(token),
        json={
            "subject_type": "user",
            "subject_id": user_id,
            "items": [{"node_key": "realestate.contracts", "effect": "deny"}],
        },
    )
    assert rp.status_code == 200
    eff1 = await client.get(f"{_H}/users/{user_id}/effective", headers=_auth(token))
    allowed = set(eff1.json()["allowed"])
    assert "realestate.contracts.create" not in allowed
    assert "realestate.payments.create" in allowed  # autre branche intacte


async def test_multi_tenant_isolation(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple[object, str]
) -> None:
    _admin, token = seed_admin
    _company2, token2 = second_admin
    rg = await client.post(
        f"{_H}/groups", headers=_auth(token), json={"slug": "secret", "name_fr": "Secret"}
    )
    group_id = rg.json()["data"]["id"]
    # Le 2ᵉ tenant ne voit pas le groupe de l'autre.
    rl = await client.get(f"{_H}/groups", headers=_auth(token2))
    ids = {g["id"] for g in rl.json()["data"]}
    assert group_id not in ids
    # Et ne peut pas poser de grants dessus (cross-tenant → 400).
    rp = await client.put(
        f"{_H}/grants",
        headers=_auth(token2),
        json={"subject_type": "group", "subject_id": group_id, "items": []},
    )
    assert rp.status_code == 400


async def test_agent_cannot_manage_access(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    ru = await client.post(
        f"{_H}/users",
        headers=_auth(token),
        json={
            "email": f"agent2-{uuid.uuid4().hex[:8]}@infinity.ae",
            "full_name": "Agent Y",
            "password": "AgentPass!23",
            "role": "agent",
        },
    )
    user_id = ru.json()["data"]["id"]
    company_id = _admin.company_id
    agent_token = encode_jwt(
        {
            "sub": user_id,
            "company_id": str(company_id),
            "role": "agent",
            "status": "active",
            "email": "agent@sgi.test",
        }
    )
    # L'agent n'a pas settings.access → 403 sur la gestion des accès.
    r = await client.get(f"{_H}/groups", headers=_auth(agent_token))
    assert r.status_code == 403


async def test_me_permissions_nav_visibility(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.get(f"{_H}/me/permissions", headers=_auth(token))
    assert r.status_code == 200
    j = r.json()
    nav_known = set(j["nav_known"])
    nav_allowed = set(j["nav_allowed"])
    # nav_keys modélisés au catalogue.
    assert "realestate_buildings" in nav_known
    assert "iam" in nav_known
    # L'admin voit tout (y compris la gestion des accès).
    assert "realestate_buildings" in nav_allowed
    assert "iam" in nav_allowed


async def test_group_membership_changes_effective(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    # Groupe avec un allow PLUS SPÉCIFIQUE que le deny baseline de l'agent sur finance.
    rg = await client.post(
        f"{_H}/groups", headers=_auth(token), json={"slug": "compta", "name_fr": "Comptabilité"}
    )
    group_id = rg.json()["data"]["id"]
    await client.put(
        f"{_H}/grants",
        headers=_auth(token),
        json={
            "subject_type": "group",
            "subject_id": group_id,
            "items": [{"node_key": "finance.overview", "effect": "allow"}],
        },
    )
    ru = await client.post(
        f"{_H}/users",
        headers=_auth(token),
        json={
            "email": f"agent3-{uuid.uuid4().hex[:8]}@infinity.ae",
            "full_name": "Agent Z",
            "password": "AgentPass!23",
            "role": "agent",
        },
    )
    user_id = ru.json()["data"]["id"]
    # Avant : l'agent (baseline) n'a pas accès à la finance.
    before = await client.get(f"{_H}/users/{user_id}/effective", headers=_auth(token))
    assert "finance.overview.read" not in set(before.json()["allowed"])
    # On l'ajoute au groupe → le grant de groupe (plus spécifique) ouvre finance.overview.
    rm = await client.post(
        f"{_H}/groups/{group_id}/members", headers=_auth(token), json={"user_id": user_id}
    )
    assert rm.status_code == 204
    after = await client.get(f"{_H}/users/{user_id}/effective", headers=_auth(token))
    assert "finance.overview.read" in set(after.json()["allowed"])


async def test_manager_cannot_manage_access(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    ru = await client.post(
        f"{_H}/users",
        headers=_auth(token),
        json={
            "email": f"mgr-{uuid.uuid4().hex[:8]}@infinity.ae",
            "full_name": "Manager M",
            "password": "MgrPass!23",
            "role": "manager",
        },
    )
    user_id = ru.json()["data"]["id"]
    mgr_token = encode_jwt(
        {
            "sub": user_id,
            "company_id": str(_admin.company_id),
            "role": "manager",
            "status": "active",
            "email": "mgr@infinity.ae",
        }
    )
    # Le manager a le métier mais PAS settings.access (réservé admin) → 403.
    r = await client.get(f"{_H}/groups", headers=_auth(mgr_token))
    assert r.status_code == 403


# ── Niveau d'assurance « UAE PASS Infinity » (endpoints) ─────────────────────


async def test_assurance_me_defaults_l0(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.get(f"{_H}/assurance/me", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["level"] == "L0"


async def test_assurance_set_then_me_reflects(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    # Admin pose les preuves email+mobile+EID sur sa propre identité → L2.
    patch = await client.patch(
        f"{_H}/assurance/user/{admin.id}",
        headers=_auth(token),
        json={"email_verified": True, "mobile_verified": True, "emirates_id_verified": True},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["data"]["level"] == "L2"
    # /me reflète le niveau.
    me = await client.get(f"{_H}/assurance/me", headers=_auth(token))
    assert me.json()["data"]["level"] == "L2"


async def test_assurance_invalid_subject_type_422(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.patch(
        f"{_H}/assurance/bogus/{uuid.uuid4()}",
        headers=_auth(token),
        json={"email_verified": True},
    )
    assert r.status_code == 422


async def test_assurance_requires_auth(client: AsyncClient) -> None:
    r = await client.get(f"{_H}/assurance/me")
    assert r.status_code in (401, 403)
