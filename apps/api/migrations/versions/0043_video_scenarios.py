"""Video scenarios — générateur de vidéos social media (photos + voix avatar).

Revision ID: 0043_video_scenarios
Revises: 0042_social_posts
Create Date: 2026-06-04

Table `video_scenarios` (RLS Loi 1) : un scénario combine plusieurs photos + une
voix (enregistrée OU générée depuis un avatar Homme/Femme) + un script, pour
produire une vidéo destinée aux réseaux sociaux. Lien polymorphe `listing_type`
('sale'|'rent') + `listing_id` (pas de FK cross-table, comme social_posts).

MVP : la génération vidéo/voix est un STUB (statut generating → ready + URL
placeholder) — câblé pour brancher un vrai fournisseur (D-ID/HeyGen + TTS) plus
tard. `photo_refs` (JSONB) et `audio_ref` portent des clés objet MinIO.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0043_video_scenarios"
down_revision = "0042_social_posts"
branch_labels = None
depends_on = None

# Valeurs — DOIVENT correspondre EXACTEMENT aux frozensets du service.
_LISTING_TYPES = "'sale','rent'"
_VOICE_MODES = "'avatar','recorded'"
_AVATARS = "'male','female'"
_STATUSES = "'draft','generating','ready','failed'"


def upgrade() -> None:
    op.create_table(
        "video_scenarios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("listing_type", sa.String(10), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("voice_mode", sa.String(10), nullable=False, server_default="avatar"),
        sa.Column("avatar", sa.String(10), nullable=True),
        sa.Column("script", sa.Text(), nullable=True),
        sa.Column("photo_refs", JSONB, nullable=False, server_default="[]"),
        sa.Column("audio_ref", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_video_scenarios_listing_type", "video_scenarios", f"listing_type IN ({_LISTING_TYPES})"
    )
    op.create_check_constraint(
        "ck_video_scenarios_voice_mode", "video_scenarios", f"voice_mode IN ({_VOICE_MODES})"
    )
    op.create_check_constraint(
        "ck_video_scenarios_avatar", "video_scenarios", f"avatar IS NULL OR avatar IN ({_AVATARS})"
    )
    op.create_check_constraint(
        "ck_video_scenarios_status", "video_scenarios", f"status IN ({_STATUSES})"
    )
    op.create_index("idx_video_scenarios_company", "video_scenarios", ["company_id"])
    op.create_index(
        "idx_video_scenarios_listing",
        "video_scenarios",
        ["company_id", "listing_type", "listing_id"],
    )
    op.execute("ALTER TABLE video_scenarios ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON video_scenarios
        USING (company_id = current_setting('app.current_company_id')::UUID);
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON video_scenarios;")
    op.drop_table("video_scenarios")
