"""Présence live — sessions pour la surveillance Self-Defense.

Revision ID: 0065_presence_session
Revises: 0064_self_defense_admin
Create Date: 2026-06-08

Une ligne par (société, session navigateur), mise à jour par heartbeat : user, ip,
géoloc (résolue localement), navigation courante, last_seen. Loi 1 : `company_id`
NOT NULL + index + RLS `tenant_isolation`.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0065_presence_session"
down_revision = "0064_self_defense_admin"
branch_labels = None
depends_on = None

TABLE = "presence_session"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("session_key", sa.String(64), nullable=False),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("geo_country", sa.String(2), nullable=True),
        sa.Column("geo_city", sa.String(120), nullable=True),
        sa.Column("geo_lat", sa.Float(), nullable=True),
        sa.Column("geo_lng", sa.Float(), nullable=True),
        sa.Column("category", sa.String(60), nullable=True),
        sa.Column("subcategory", sa.String(60), nullable=True),
        sa.Column("page", sa.String(120), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    # Une session unique par (société, clé de session).
    op.create_index(
        "idx_presence_session_company_key", TABLE, ["company_id", "session_key"], unique=True
    )
    # Requête des sessions actives (fenêtre last_seen).
    op.create_index("idx_presence_session_company_seen", TABLE, ["company_id", "last_seen_at"])

    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY;")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {TABLE}
        USING (company_id = current_setting('app.current_company_id')::UUID);
        """
    )


def downgrade() -> None:
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {TABLE};")
    op.drop_index("idx_presence_session_company_seen", table_name=TABLE)
    op.drop_index("idx_presence_session_company_key", table_name=TABLE)
    op.drop_table(TABLE)
