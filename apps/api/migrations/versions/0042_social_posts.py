"""Social posts — publication d'une annonce (vente/location) sur les réseaux sociaux.

Revision ID: 0042_social_posts
Revises: 0041_user_public_profile
Create Date: 2026-06-04

Table `social_posts` (RLS Loi 1) : trace la publication d'une annonce sur un
canal social (Facebook, Instagram, LinkedIn, X, WhatsApp, TikTok, Snapchat).
Lien polymorphe `listing_type` ('sale'|'rent') + `listing_id` (pas de FK
cross-table, comme le module documents). Un seul post ACTIF par
(tenant, annonce, canal) via index unique partiel (deleted_at IS NULL).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0042_social_posts"
down_revision = "0041_user_public_profile"
branch_labels = None
depends_on = None

# Valeurs — DOIVENT correspondre EXACTEMENT aux frozensets du service.
_LISTING_TYPES = "'sale','rent'"
_CHANNELS = "'facebook','instagram','linkedin','x','whatsapp','tiktok','snapchat'"
_STATUSES = "'pending','published','failed'"


def upgrade() -> None:
    op.create_table(
        "social_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("listing_type", sa.String(10), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("channel", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="published"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_social_posts_listing_type", "social_posts", f"listing_type IN ({_LISTING_TYPES})"
    )
    op.create_check_constraint(
        "ck_social_posts_channel", "social_posts", f"channel IN ({_CHANNELS})"
    )
    op.create_check_constraint("ck_social_posts_status", "social_posts", f"status IN ({_STATUSES})")
    op.create_index("idx_social_posts_company", "social_posts", ["company_id"])
    op.create_index(
        "idx_social_posts_listing",
        "social_posts",
        ["company_id", "listing_type", "listing_id"],
    )
    # Un seul post ACTIF par (tenant, annonce, canal).
    op.create_index(
        "uq_social_posts_active",
        "social_posts",
        ["company_id", "listing_type", "listing_id", "channel"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.execute("ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON social_posts
        USING (company_id = current_setting('app.current_company_id')::UUID);
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON social_posts;")
    op.drop_table("social_posts")
