"""Device tokens — jetons push mobiles/web (FCM/APNs).

Revision ID: 0049_device_tokens
Revises: 0048_admin_console
Create Date: 2026-06-05

Table métier (RLS Loi 1 — company_id + policy + index) :
- device_tokens : un jeton par appareil, rattaché à un user, unique par tenant.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0049_device_tokens"
down_revision = "0048_admin_console"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "device_tokens",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(512), nullable=False),
        sa.Column("platform", sa.String(10), nullable=False, server_default="android"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("platform IN ('ios','android','web')", name="ck_device_tokens_platform"),
        sa.UniqueConstraint("company_id", "token", name="uq_device_tokens_company_token"),
    )
    op.create_index("idx_device_tokens_company", "device_tokens", ["company_id"])
    op.create_index("idx_device_tokens_company_user", "device_tokens", ["company_id", "user_id"])
    op.create_index("idx_device_tokens_user", "device_tokens", ["user_id"])

    op.execute("ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON device_tokens
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON device_tokens;")
    op.drop_table("device_tokens")
