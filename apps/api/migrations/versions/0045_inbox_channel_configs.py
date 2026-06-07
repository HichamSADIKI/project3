"""Inbox channel configs — routage `phone_number_id` → tenant (WhatsApp).

Revision ID: 0045_inbox_channel_configs
Revises: 0044_social_post_video
Create Date: 2026-06-04

Table de routage des canaux externes entrants vers un tenant. Résout le
problème multi-tenant du webhook WhatsApp : Meta n'envoie pas de JWT, juste un
`phone_number_id`. La table porte `company_id` + RLS (Loi 1) pour le CRUD
métier (enrôlement tenant-scopé). Le webhook, lui, n'a PAS de contexte tenant →
il résout via la fonction **SECURITY DEFINER** `inbox_resolve_company(channel,
phone_number_id)`, propriété de l'owner des tables (sgi_user, exempt de RLS),
qui contourne la RLS UNIQUEMENT pour ce lookup étroit (retourne seulement le
`company_id` du canal actif). `phone_number_id` est unique GLOBALEMENT par
canal (un numéro WhatsApp ne route que vers un seul tenant).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0045_inbox_channel_configs"
down_revision = "0044_social_post_video"
branch_labels = None
depends_on = None

_CHANNELS = "'whatsapp','facebook','instagram','email','webchat'"


def upgrade() -> None:
    op.create_table(
        "inbox_channel_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("phone_number_id", sa.String(64), nullable=False),
        sa.Column("display_phone_number", sa.String(32), nullable=True),
        sa.Column("label", sa.String(120), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
        sa.CheckConstraint(f"channel IN ({_CHANNELS})", name="ck_inbox_channel_configs_channel"),
    )
    op.create_index("idx_inbox_channel_configs_company", "inbox_channel_configs", ["company_id"])
    # Un (canal, phone_number_id) route vers UN seul tenant → unicité GLOBALE
    # (pas par société), sur les lignes vivantes uniquement.
    op.create_index(
        "uq_inbox_channel_phone",
        "inbox_channel_configs",
        ["channel", "phone_number_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # RLS (Loi 1) — CRUD métier (enrôlement/liste) strictement tenant-scopé.
    op.execute("ALTER TABLE inbox_channel_configs ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON inbox_channel_configs
        USING (company_id = current_setting('app.current_company_id')::UUID);
        """
    )

    # Résolution tenant pour le webhook (AUCUN contexte RLS) : fonction
    # SECURITY DEFINER (owner = sgi_user, exempt de RLS) → contournement étroit
    # qui ne retourne QUE le company_id du canal actif. `search_path` figé pour
    # éviter le détournement de résolution de nom (bonne pratique SECURITY DEFINER).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION inbox_resolve_company(
            p_channel text, p_phone_number_id text
        )
        RETURNS uuid
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT company_id
            FROM inbox_channel_configs
            WHERE channel = p_channel
              AND phone_number_id = p_phone_number_id
              AND is_active = true
              AND deleted_at IS NULL
            LIMIT 1;
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS inbox_resolve_company(text, text);")
    op.drop_index("uq_inbox_channel_phone", table_name="inbox_channel_configs")
    op.drop_index("idx_inbox_channel_configs_company", table_name="inbox_channel_configs")
    op.drop_table("inbox_channel_configs")
