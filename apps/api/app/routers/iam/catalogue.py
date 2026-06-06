"""Catalogue statique des permissions (l'arbre des ressources) + grants par défaut.

Dépendances : **stdlib uniquement** — ce module est importé par la migration
`0036_iam` pour seeder `permission_nodes` (nœuds système, `company_id` NULL) et
les grants par défaut des groupes système. Ne JAMAIS y importer FastAPI/SQLAlchemy.

Conception :
- Une catégorie (`category`) regroupe des pages.
- Une page (`page`) = un écran du back-office, reliée à `nav_key`/`screen_key`.
- Une action (`action`) = une opération API gardée par `require_permission(<key>)`.
- Les sections (`section`) et champs (`field`) sont ajoutés au fil des phases ;
  on en seede quelques-uns d'exemple sur les contrats pour valider la chaîne.

Les **clés sont stables** (jamais dérivées d'une URL) : `realestate.contracts.delete`.
Un droit posé sur un nœud cascade à tous ses descendants (cf. `service.resolve_effective`).
"""

from __future__ import annotations

from typing import Literal, TypedDict

NodeType = Literal["category", "page", "section", "field", "action"]

# Actions CRUD standard appliquées à chaque page (sauf override via `actions=`).
_CRUD: tuple[tuple[str, str, str, str], ...] = (
    # (suffixe, ar, en, fr)
    ("read", "عرض", "View", "Consulter"),
    ("create", "إنشاء", "Create", "Créer"),
    ("update", "تعديل", "Update", "Modifier"),
    ("delete", "حذف", "Delete", "Supprimer"),
)


class NodeDef(TypedDict):
    key: str
    parent_key: str | None
    type: NodeType
    label_ar: str
    label_en: str
    label_fr: str
    nav_key: str | None
    screen_key: str | None
    sort_order: int


# ── Catégories de premier niveau ────────────────────────────────────────────────
# (key, ar, en, fr)
_CATEGORIES: tuple[tuple[str, str, str, str], ...] = (
    ("realestate", "العقارات", "Real Estate", "Immobilier"),
    ("crm", "إدارة العملاء", "CRM", "CRM"),
    ("finance", "المالية", "Finance", "Finance"),
    ("settings", "الإعدادات", "Settings", "Paramètres"),
)

# ── Pages (modules back-office) ─────────────────────────────────────────────────
# (key, category, ar, en, fr, nav_key, screen_key)
_PAGES: tuple[tuple[str, str, str, str, str, str | None, str | None], ...] = (
    # Immobilier
    (
        "realestate.buildings",
        "realestate",
        "المباني",
        "Buildings",
        "Bâtiments",
        "realestate_buildings",
        "realestate-buildings",
    ),
    (
        "realestate.units",
        "realestate",
        "الوحدات",
        "Units",
        "Unités",
        "realestate_units",
        "realestate-units",
    ),
    (
        "realestate.tenants",
        "realestate",
        "المستأجرون",
        "Tenants",
        "Locataires",
        "realestate_tenants",
        "realestate-tenants",
    ),
    (
        "realestate.owners",
        "realestate",
        "الملاك",
        "Owners",
        "Propriétaires",
        "realestate_owners",
        "realestate-owners",
    ),
    (
        "realestate.contracts",
        "realestate",
        "العقود",
        "Contracts",
        "Contrats",
        "realestate_contracts",
        "realestate-contracts",
    ),
    (
        "realestate.payments",
        "realestate",
        "المدفوعات",
        "Payments",
        "Paiements",
        "realestate_payments",
        "realestate-payments",
    ),
    (
        "realestate.cheques",
        "realestate",
        "الشيكات",
        "Cheques",
        "Chèques",
        "realestate_cheques",
        "realestate-cheques",
    ),
    (
        "realestate.maintenance",
        "realestate",
        "الصيانة",
        "Maintenance",
        "Maintenance",
        "realestate_maintenance",
        "maintenance",
    ),
    (
        "realestate.comms",
        "realestate",
        "التواصل",
        "Communication",
        "Communication",
        "realestate_comms",
        "realestate-comms",
    ),
    (
        "realestate.inbox",
        "realestate",
        "صندوق الوارد",
        "Inbox",
        "Inbox",
        "realestate_inbox",
        "realestate-inbox",
    ),
    (
        "realestate.tickets",
        "realestate",
        "التذاكر",
        "Tickets",
        "Tickets",
        "realestate_tickets",
        "realestate-tickets",
    ),
    (
        "realestate.documents",
        "realestate",
        "الوثائق",
        "Documents",
        "Documents",
        "realestate_documents",
        "realestate-documents",
    ),
    (
        "realestate.achat",
        "realestate",
        "الشراء",
        "Acquisition",
        "Achat",
        "realestate_achat",
        "realestate-achat",
    ),
    (
        "realestate.vente",
        "realestate",
        "البيع",
        "Sale",
        "Vente",
        "realestate_vente",
        "realestate-vente",
    ),
    (
        "realestate.location",
        "realestate",
        "الإيجار",
        "Leasing",
        "Location",
        "realestate_location",
        "realestate-location",
    ),
    (
        "realestate.branches",
        "realestate",
        "الفروع",
        "Branches",
        "Succursales",
        "realestate_branches",
        "realestate-branches",
    ),
    (
        "realestate.owner_portal",
        "realestate",
        "بوابة المالك",
        "Owner Portal",
        "Portail Propriétaire",
        "realestate_owner_portal",
        "realestate-owner-portal",
    ),
    (
        "realestate.workflows",
        "realestate",
        "سير العمل",
        "Workflows",
        "Validations",
        "realestate_workflows",
        "realestate-workflows",
    ),
    (
        "realestate.settings",
        "realestate",
        "إعدادات العقارات",
        "RE Settings",
        "Paramètres immobilier",
        "realestate_settings",
        "realestate-settings",
    ),
    # CRM
    ("crm.pipeline", "crm", "مسار العملاء", "Pipeline", "Pipeline", "crm", "crm"),
    # Finance
    ("finance.overview", "finance", "المالية", "Finance", "Finance", "finance", "finance"),
    # Paramètres
    (
        "settings.access",
        "settings",
        "الوصول والصلاحيات",
        "Access & Permissions",
        "Accès & Permissions",
        "iam",
        "iam-matrix",
    ),
    (
        "settings.preferences",
        "settings",
        "التفضيلات",
        "Preferences",
        "Préférences",
        "parametres",
        "parametres",
    ),
)

# Pages en lecture seule (pas d'actions create/update/delete).
_READONLY_PAGES: frozenset[str] = frozenset({"finance.overview", "realestate.owner_portal"})

# Sections/champs d'exemple (Phase 1) pour valider la chaîne « voir un champ ».
# (key, page_parent, type, ar, en, fr)
_SECTIONS_FIELDS: tuple[tuple[str, str, NodeType, str, str, str], ...] = (
    (
        "realestate.contracts.finance",
        "realestate.contracts",
        "section",
        "القسم المالي",
        "Financials",
        "Finances",
    ),
    (
        "realestate.contracts.finance.commission",
        "realestate.contracts.finance",
        "field",
        "العمولة",
        "Commission",
        "Commission",
    ),
    (
        "realestate.contracts.finance.rent_amount",
        "realestate.contracts.finance",
        "field",
        "قيمة الإيجار",
        "Rent amount",
        "Montant du loyer",
    ),
)


def build_catalogue() -> list[NodeDef]:
    """Construit la liste à plat des nœuds système (parent → enfants, ordre stable)."""
    nodes: list[NodeDef] = []
    order = 0

    def add(
        key: str,
        parent: str | None,
        ntype: NodeType,
        ar: str,
        en: str,
        fr: str,
        nav_key: str | None = None,
        screen_key: str | None = None,
    ) -> None:
        nonlocal order
        order += 1
        nodes.append(
            NodeDef(
                key=key,
                parent_key=parent,
                type=ntype,
                label_ar=ar,
                label_en=en,
                label_fr=fr,
                nav_key=nav_key,
                screen_key=screen_key,
                sort_order=order,
            )
        )

    for ckey, ar, en, fr in _CATEGORIES:
        add(ckey, None, "category", ar, en, fr)

    for pkey, cat, ar, en, fr, nav_key, screen_key in _PAGES:
        add(pkey, cat, "page", ar, en, fr, nav_key, screen_key)
        suffixes = ("read",) if pkey in _READONLY_PAGES else None
        for suf, sar, sen, sfr in _CRUD:
            if suffixes is not None and suf not in suffixes:
                continue
            add(f"{pkey}.{suf}", pkey, "action", f"{sar} {en}", f"{sen} {en}", f"{sfr} {fr}")

    for key, parent, ntype, ar, en, fr in _SECTIONS_FIELDS:
        add(key, parent, ntype, ar, en, fr)

    return nodes


# ── Grants par défaut des rôles (socle de compatibilité) ────────────────────────
# Convertis en groupes système au bootstrap d'une société. Reproduisent l'ancien
# comportement `require_roles` : tout casse-rien le jour de la bascule.
#   "*"  = racine (tous les nœuds).  Un allow sur une catégorie cascade à ses pages.
# Précédence basse (socle) ; les groupes/unités/users métier surchargent au-dessus.
DEFAULT_ROLE_GRANTS: dict[str, dict[str, list[str]]] = {
    # admin : tout, y compris la gestion des accès. On pose l'allow sur les 4
    # catégories racines (qui cascadent à tout) plutôt que sur chaque nœud → seed léger.
    "admin": {"allow": ["realestate", "crm", "finance", "settings"], "deny": []},
    # manager : tout le métier, mais pas la gestion des accès (réservée admin).
    "manager": {"allow": ["realestate", "crm", "finance"], "deny": ["settings.access"]},
    # agent : métier en lecture/écriture, mais pas de suppression ni de finance ni d'accès.
    "agent": {
        "allow": ["realestate", "crm"],
        "deny": ["finance", "settings.access", "__all_delete__"],
    },
    # client / fournisseur : aucun accès back-office (ils passent par les portails,
    # toujours gardés par identité de rôle — hors du périmètre IAM staff).
    "client": {"allow": [], "deny": []},
    "fournisseur": {"allow": [], "deny": []},
}

# Rôles staff réellement provisionnés comme groupes système (les portails restent
# gardés par rôle/identité, pas par ce catalogue).
SYSTEM_GROUP_ROLES: tuple[str, ...] = ("admin", "manager", "agent")

# Libellés i18n des groupes système.
SYSTEM_GROUP_LABELS: dict[str, tuple[str, str, str]] = {
    "admin": ("مدير النظام", "Administrators", "Administrateurs"),
    "manager": ("المديرون", "Managers", "Managers"),
    "agent": ("الوكلاء", "Agents", "Agents"),
}


def all_delete_action_keys(nodes: list[NodeDef] | None = None) -> list[str]:
    """Toutes les clés d'action de suppression (pour le deny `__all_delete__`)."""
    nodes = nodes or build_catalogue()
    return [n["key"] for n in nodes if n["type"] == "action" and n["key"].endswith(".delete")]


def expand_default_grants(role: str, nodes: list[NodeDef] | None = None) -> dict[str, list[str]]:
    """Résout les sentinelles (`*`, `__all_delete__`) en listes concrètes de clés."""
    nodes = nodes or build_catalogue()
    spec = DEFAULT_ROLE_GRANTS.get(role, {"allow": [], "deny": []})
    all_keys = [n["key"] for n in nodes]
    allow: list[str] = []
    for k in spec["allow"]:
        allow.extend(all_keys if k == "*" else [k])
    deny: list[str] = []
    for k in spec["deny"]:
        deny.extend(all_delete_action_keys(nodes) if k == "__all_delete__" else [k])
    return {"allow": sorted(set(allow)), "deny": sorted(set(deny))}
