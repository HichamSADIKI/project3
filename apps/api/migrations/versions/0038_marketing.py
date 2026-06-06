"""Marketing — campagnes de diffusion + unités liées.

Revision ID: 0036_marketing
Revises: 0035_leasing
Create Date: 2026-06-03

Sous-catégorie « Marketing » : une campagne (`marketing_campaigns`) sur un canal
et une période, des unités commercialisées liées (`marketing_campaign_units`),
des métriques (vues/clics/leads/dépense) alimentées par les connecteurs stubs.

Tables (RLS Loi 1) :
- marketing_campaigns       : campagne (canal, statut draft→completed/cancelled, métriques AED)
- marketing_campaign_units  : jointure N:N campagne ↔ unité (porte company_id)
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0038_marketing"
down_revision = "0037_developers"
branch_labels = None
depends_on = None

# Canaux & statuts — DOIVENT correspondre EXACTEMENT aux helpers du service.
_CHANNELS = (
    "'social_facebook','social_instagram','social_linkedin',"
    "'portal_bayut','portal_propertyfinder','portal_dubizzle','email','other'"
)
_STATUSES = "'draft','scheduled','active','paused','completed','cancelled'"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── marketing_campaigns ─────────────────────────────────────────────────────
    op.create_table(
        "marketing_campaigns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("channel", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("starts_on", sa.Date, nullable=True),
        sa.Column("ends_on", sa.Date, nullable=True),
        sa.Column("budget_aed", sa.Numeric(15, 2), nullable=True),
        sa.Column("spend_aed", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("impressions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer, nullable=False, server_default="0"),
        sa.Column("leads_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("external_ref", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_marketing_campaigns_channel", "marketing_campaigns", f"channel IN ({_CHANNELS})"
    )
    op.create_check_constraint(
        "ck_marketing_campaigns_status", "marketing_campaigns", f"status IN ({_STATUSES})"
    )
    op.create_index("idx_marketing_campaigns_company", "marketing_campaigns", ["company_id"])
    op.create_index(
        "idx_marketing_campaigns_company_status", "marketing_campaigns", ["company_id", "status"]
    )
    op.create_index(
        "uq_marketing_campaigns_reference",
        "marketing_campaigns",
        ["company_id", "reference"],
        unique=True,
    )
    _rls("marketing_campaigns")

    # ── marketing_campaign_units ────────────────────────────────────────────────
    op.create_table(
        "marketing_campaign_units",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "campaign_id",
            UUID(as_uuid=True),
            sa.ForeignKey("marketing_campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "unit_id",
            UUID(as_uuid=True),
            sa.ForeignKey("units.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_unique_constraint(
        "uq_mcu_campaign_unit", "marketing_campaign_units", ["campaign_id", "unit_id"]
    )
    op.create_index("idx_mcu_company", "marketing_campaign_units", ["company_id"])
    op.create_index(
        "idx_mcu_company_campaign", "marketing_campaign_units", ["company_id", "campaign_id"]
    )
    _rls("marketing_campaign_units")


def downgrade() -> None:
    for t in ("marketing_campaign_units", "marketing_campaigns"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
