"""Honeytokens — leurres de sécurité (déception, Axe 7 de la doctrine).

Revision ID: 0062_honeytokens
Revises: 0061_public_site_design
Create Date: 2026-06-07

Une ligne = un leurre planté par une société. L'utilisation du `token` (endpoint
trip) déclenche une alerte critique. Loi 1 : `company_id NOT NULL` + index + RLS.
Le rôle restreint `sgi_app` reçoit ses droits via l'ALTER DEFAULT PRIVILEGES (0023).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0062_honeytokens"
down_revision = "0061_public_site_design"
branch_labels = None
depends_on = None

TABLE = "honeytokens"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False, server_default="api_key"),
        sa.Column("label", sa.String(160), nullable=False),
        sa.Column("token", sa.String(128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trigger_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "kind IN ('api_key','url','secret','record')", name="ck_honeytoken_kind"
        ),
    )
    op.create_index("idx_honeytokens_company", TABLE, ["company_id"])
    # Le token est un secret global unique (résolu hors RLS sur l'endpoint trip).
    op.create_index("idx_honeytokens_token", TABLE, ["token"], unique=True)

    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY;")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {TABLE}
        USING (company_id = current_setting('app.current_company_id')::UUID);
        """
    )


def downgrade() -> None:
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {TABLE};")
    op.drop_index("idx_honeytokens_token", table_name=TABLE)
    op.drop_index("idx_honeytokens_company", table_name=TABLE)
    op.drop_table(TABLE)
