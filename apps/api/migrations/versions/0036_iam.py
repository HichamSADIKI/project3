"""IAM — gestion des accès & permissions hiérarchiques.

Revision ID: 0036_iam
Revises: 0035_leasing
Create Date: 2026-06-03

Deux axes d'héritage (cf. app/routers/iam/service.resolve_effective) :
- Ressources : `permission_nodes` (arbre catégorie→page→section→champ/action). Catalogue
  système global (company_id NULL) seedé ici depuis app/routers/iam/catalogue.py.
- Sujets : `iam_groups` → `iam_units` (sous-groupe) → utilisateur, reliés par
  `iam_group_members`/`iam_unit_members` ; droits portés par `iam_access_grants`.

Bootstrap (compatibilité, casse-rien) : pour CHAQUE société existante on crée 3 groupes
système (admin/manager/agent) reproduisant les `require_roles` actuels via des grants par
défaut, et on rattache chaque utilisateur au groupe système de son rôle.

Tables RLS (Loi 1) sauf le catalogue système (company_id NULL → lisible par tous).
"""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

from app.routers.iam.catalogue import (
    SYSTEM_GROUP_LABELS,
    SYSTEM_GROUP_ROLES,
    build_catalogue,
    expand_default_grants,
)

revision = "0036_iam"
down_revision = "0035_leasing"
branch_labels = None
depends_on = None

_NODE_TYPES = "'category','page','section','field','action'"
_SUBJECT_TYPES = "'group','unit','user'"
_EFFECTS = "'allow','deny'"
_SCOPES = "'all','own','branch'"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── permission_nodes (catalogue : système NULL + extensions par société) ──────
    op.create_table(
        "permission_nodes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "parent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("permission_nodes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("key", sa.String(150), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("label_ar", sa.String(255), nullable=True),
        sa.Column("label_en", sa.String(255), nullable=True),
        sa.Column("label_fr", sa.String(255), nullable=True),
        sa.Column("nav_key", sa.String(80), nullable=True),
        sa.Column("screen_key", sa.String(80), nullable=True),
        sa.Column("api_method", sa.String(10), nullable=True),
        sa.Column("api_path", sa.String(255), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_check_constraint(
        "ck_permission_nodes_type", "permission_nodes", f"type IN ({_NODE_TYPES})"
    )
    op.create_index("idx_permission_nodes_company", "permission_nodes", ["company_id"])
    op.create_index("idx_permission_nodes_parent", "permission_nodes", ["parent_id"])
    # Unicité des clés : système (company_id NULL) et par société.
    op.execute(
        "CREATE UNIQUE INDEX uq_permission_nodes_system_key "
        "ON permission_nodes (key) WHERE company_id IS NULL;"
    )
    op.create_index(
        "uq_permission_nodes_company_key", "permission_nodes", ["company_id", "key"], unique=True
    )
    # RLS spéciale : on lit les nœuds système (NULL) + ceux de son tenant.
    op.execute("ALTER TABLE permission_nodes ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON permission_nodes
        USING (company_id IS NULL OR company_id = current_setting('app.current_company_id')::UUID);
    """)

    # ── iam_groups ────────────────────────────────────────────────────────────────
    op.create_table(
        "iam_groups",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(60), nullable=False),
        sa.Column("name_ar", sa.String(160), nullable=True),
        sa.Column("name_en", sa.String(160), nullable=True),
        sa.Column("name_fr", sa.String(160), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_iam_groups_company", "iam_groups", ["company_id"])
    op.create_index("uq_iam_groups_company_slug", "iam_groups", ["company_id", "slug"], unique=True)
    _rls("iam_groups")

    # ── iam_units (sous-groupes) ─────────────────────────────────────────────────
    op.create_table(
        "iam_units",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "group_id",
            UUID(as_uuid=True),
            sa.ForeignKey("iam_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(60), nullable=True),
        sa.Column("name_ar", sa.String(160), nullable=True),
        sa.Column("name_en", sa.String(160), nullable=True),
        sa.Column("name_fr", sa.String(160), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_iam_units_company", "iam_units", ["company_id"])
    op.create_index("idx_iam_units_group", "iam_units", ["company_id", "group_id"])
    _rls("iam_units")

    # ── iam_group_members ────────────────────────────────────────────────────────
    op.create_table(
        "iam_group_members",
        sa.Column(
            "group_id",
            UUID(as_uuid=True),
            sa.ForeignKey("iam_groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("idx_iam_group_members_company", "iam_group_members", ["company_id"])
    op.create_index("idx_iam_group_members_user", "iam_group_members", ["company_id", "user_id"])
    _rls("iam_group_members")

    # ── iam_unit_members ─────────────────────────────────────────────────────────
    op.create_table(
        "iam_unit_members",
        sa.Column(
            "unit_id",
            UUID(as_uuid=True),
            sa.ForeignKey("iam_units.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("idx_iam_unit_members_company", "iam_unit_members", ["company_id"])
    op.create_index("idx_iam_unit_members_user", "iam_unit_members", ["company_id", "user_id"])
    _rls("iam_unit_members")

    # ── iam_access_grants ────────────────────────────────────────────────────────
    op.create_table(
        "iam_access_grants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("subject_type", sa.String(10), nullable=False),
        sa.Column("subject_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "node_id",
            UUID(as_uuid=True),
            sa.ForeignKey("permission_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("effect", sa.String(5), nullable=False),
        sa.Column("scope", sa.String(10), nullable=False, server_default="all"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_check_constraint(
        "ck_iam_grants_subject_type", "iam_access_grants", f"subject_type IN ({_SUBJECT_TYPES})"
    )
    op.create_check_constraint(
        "ck_iam_grants_effect", "iam_access_grants", f"effect IN ({_EFFECTS})"
    )
    op.create_check_constraint("ck_iam_grants_scope", "iam_access_grants", f"scope IN ({_SCOPES})")
    op.create_index("idx_iam_grants_company", "iam_access_grants", ["company_id"])
    op.create_index(
        "idx_iam_grants_subject", "iam_access_grants", ["company_id", "subject_type", "subject_id"]
    )
    op.create_index(
        "uq_iam_grants_unique",
        "iam_access_grants",
        ["company_id", "subject_type", "subject_id", "node_id"],
        unique=True,
    )
    _rls("iam_access_grants")

    # ── Seed du catalogue système + bootstrap des sociétés existantes ─────────────
    _seed_catalogue_and_bootstrap()


def _seed_catalogue_and_bootstrap() -> None:
    conn = op.get_bind()
    nodes = build_catalogue()

    # 1) Catalogue système : id par clé, puis parent_id en 2ᵉ passe.
    key_to_id: dict[str, uuid.UUID] = {n["key"]: uuid.uuid4() for n in nodes}
    for n in nodes:
        conn.execute(
            sa.text(
                "INSERT INTO permission_nodes "
                "(id, company_id, parent_id, key, type, label_ar, label_en, label_fr, "
                " nav_key, screen_key, sort_order, is_system) "
                "VALUES (:id, NULL, :parent_id, :key, :type, :ar, :en, :fr, "
                " :nav, :screen, :sort, true)"
            ),
            {
                "id": key_to_id[n["key"]],
                "parent_id": key_to_id[n["parent_key"]] if n["parent_key"] else None,
                "key": n["key"],
                "type": n["type"],
                "ar": n["label_ar"],
                "en": n["label_en"],
                "fr": n["label_fr"],
                "nav": n["nav_key"],
                "screen": n["screen_key"],
                "sort": n["sort_order"],
            },
        )

    # 2) Bootstrap par société : 3 groupes système + grants par défaut + affectation users.
    companies = conn.execute(
        sa.text("SELECT id FROM companies WHERE deleted_at IS NULL")
    ).fetchall()
    for (company_id,) in companies:
        role_to_group: dict[str, uuid.UUID] = {}
        for role in SYSTEM_GROUP_ROLES:
            gid = uuid.uuid4()
            role_to_group[role] = gid
            ar, en, fr = SYSTEM_GROUP_LABELS[role]
            conn.execute(
                sa.text(
                    "INSERT INTO iam_groups "
                    "(id, company_id, slug, name_ar, name_en, name_fr, is_system) "
                    "VALUES (:id, :cid, :slug, :ar, :en, :fr, true)"
                ),
                {"id": gid, "cid": company_id, "slug": f"sys-{role}", "ar": ar, "en": en, "fr": fr},
            )
            grants = expand_default_grants(role, nodes)
            for effect, keys in (("allow", grants["allow"]), ("deny", grants["deny"])):
                for k in keys:
                    node_id = key_to_id.get(k)
                    if node_id is None:
                        continue
                    conn.execute(
                        sa.text(
                            "INSERT INTO iam_access_grants "
                            "(id, company_id, subject_type, subject_id, node_id, effect, scope) "
                            "VALUES (:id, :cid, 'group', :sid, :nid, :eff, 'all') "
                            "ON CONFLICT (company_id, subject_type, subject_id, node_id) DO NOTHING"
                        ),
                        {
                            "id": uuid.uuid4(),
                            "cid": company_id,
                            "sid": gid,
                            "nid": node_id,
                            "eff": effect,
                        },
                    )

        # Affecter chaque utilisateur staff au groupe système de son rôle.
        users = conn.execute(
            sa.text("SELECT id, role FROM users WHERE company_id = :cid AND deleted_at IS NULL"),
            {"cid": company_id},
        ).fetchall()
        for user_id, role in users:
            gid = role_to_group.get(role)
            if gid is None:
                continue
            conn.execute(
                sa.text(
                    "INSERT INTO iam_group_members (group_id, user_id, company_id) "
                    "VALUES (:gid, :uid, :cid) ON CONFLICT DO NOTHING"
                ),
                {"gid": gid, "uid": user_id, "cid": company_id},
            )


def downgrade() -> None:
    for t in (
        "iam_access_grants",
        "iam_unit_members",
        "iam_group_members",
        "iam_units",
        "iam_groups",
        "permission_nodes",
    ):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
