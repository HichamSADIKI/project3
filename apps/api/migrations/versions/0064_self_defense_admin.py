"""Self-Defense — administration (config codes hashés + verrouillage par user).

Revision ID: 0064_self_defense_admin
Revises: 0063_user_oauth_link
Create Date: 2026-06-08

- `self_defense_config` : 1 ligne/société — codes hashés (armer/désarmer), nb
  d'essais max, armgate activé, options JSONB extensibles.
- `self_defense_lockout` : 1 ligne/(société,utilisateur) — compteur d'échecs + verrou.

Loi 1 : `company_id NOT NULL` + index + RLS `tenant_isolation` sur les 2 tables.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0064_self_defense_admin"
down_revision = "0063_user_oauth_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "self_defense_config",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("arm_code_hash", sa.String(255), nullable=True),
        sa.Column("disarm_code_hash", sa.String(255), nullable=True),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("armgate_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("options", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("max_attempts >= 1 AND max_attempts <= 10", name="ck_sdc_max_attempts"),
    )
    # Une seule config par société.
    op.create_index(
        "idx_self_defense_config_company", "self_defense_config", ["company_id"], unique=True
    )

    op.create_table(
        "self_defense_lockout",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    # Un état de verrouillage par (société, utilisateur).
    op.create_index(
        "idx_self_defense_lockout_company_user",
        "self_defense_lockout",
        ["company_id", "user_id"],
        unique=True,
    )

    for table in ("self_defense_config", "self_defense_lockout"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (company_id = current_setting('app.current_company_id')::UUID);
            """
        )


def downgrade() -> None:
    for table in ("self_defense_lockout", "self_defense_config"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
    op.drop_index("idx_self_defense_lockout_company_user", table_name="self_defense_lockout")
    op.drop_table("self_defense_lockout")
    op.drop_index("idx_self_defense_config_company", table_name="self_defense_config")
    op.drop_table("self_defense_config")
