"""Phase 1 — Tables modules client_portal + partner.

Revision ID: 0005_client_partner_modules
Revises: 0004_user_roles_status
Create Date: 2026-05-28

Tables créées :
  Client :
   - favorites              — biens favoris du client
   - visit_requests         — demandes de visite
   - messages               — messagerie client/partner ↔ agent

  Partner :
   - property_submissions          — biens proposés par partenaires (avant validation)
   - partner_leads                 — leads apportés
   - partner_commission_entries    — commissions à percevoir
   - partner_services              — prestations notaires/banques/assurances

Lois respectées :
- Loi 1 : company_id + index + RLS sur les 7 tables
- Soft delete : deleted_at sur les tables CRUD (pas sur favorites — relation simple)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0005_client_partner_modules"
down_revision = "0004_user_roles_status"
branch_labels = None
depends_on = None


_RLS_TABLES = (
    "favorites",
    "visit_requests",
    "messages",
    "property_submissions",
    "partner_leads",
    "partner_commission_entries",
    "partner_services",
)


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID)
        """
    )


def upgrade() -> None:
    # ── favorites ─────────────────────────────────────────────────────────
    op.create_table(
        "favorites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "property_id",
            UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "property_id", name="uq_favorites_user_property"),
    )
    op.create_index("idx_favorites_company", "favorites", ["company_id"])
    op.create_index("idx_favorites_user", "favorites", ["user_id"])
    _enable_rls("favorites")

    # ── visit_requests ────────────────────────────────────────────────────
    op.create_table(
        "visit_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "property_id",
            UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "agent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("preferred_date", sa.Date(), nullable=False),
        sa.Column("preferred_time_slot", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("client_notes", sa.Text(), nullable=True),
        sa.Column("agent_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending','confirmed','done','cancelled','no_show')",
            name="ck_visit_requests_status",
        ),
    )
    op.create_index("idx_visit_requests_company", "visit_requests", ["company_id"])
    op.create_index("idx_visit_requests_user", "visit_requests", ["user_id"])
    op.create_index("idx_visit_requests_status", "visit_requests", ["status"])
    _enable_rls("visit_requests")

    # ── messages ──────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "sender_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(255), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "related_property_id",
            UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "related_contract_id",
            UUID(as_uuid=True),
            sa.ForeignKey("contracts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_messages_company", "messages", ["company_id"])
    op.create_index("idx_messages_sender", "messages", ["sender_user_id"])
    op.create_index("idx_messages_recipient", "messages", ["recipient_user_id"])
    op.create_index("idx_messages_unread", "messages", ["recipient_user_id", "read_at"])
    _enable_rls("messages")

    # ── property_submissions (partenaire) ─────────────────────────────────
    op.create_table(
        "property_submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "submitter_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("district", sa.String(150), nullable=True),
        sa.Column("city", sa.String(100), nullable=False, server_default="Dubai"),
        sa.Column("asking_price", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("area_sqm", sa.DECIMAL(10, 2), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=True),
        sa.Column("bathrooms", sa.Integer(), nullable=True),
        sa.Column("contact_phone", sa.String(50), nullable=True),
        sa.Column("images", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "reviewed_by_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column(
            "converted_property_id",
            UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected','converted')",
            name="ck_property_submissions_status",
        ),
    )
    op.create_index("idx_property_submissions_company", "property_submissions", ["company_id"])
    op.create_index("idx_property_submissions_submitter", "property_submissions", ["submitter_user_id"])
    op.create_index("idx_property_submissions_status", "property_submissions", ["status"])
    _enable_rls("property_submissions")

    # ── partner_leads ─────────────────────────────────────────────────────
    op.create_table(
        "partner_leads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "submitter_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("prospect_first_name", sa.String(150), nullable=False),
        sa.Column("prospect_last_name", sa.String(150), nullable=True),
        sa.Column("prospect_email", sa.String(255), nullable=True),
        sa.Column("prospect_phone", sa.String(50), nullable=False),
        sa.Column("prospect_nationality", sa.String(100), nullable=True),
        sa.Column("interest_type", sa.String(20), nullable=False),
        sa.Column("budget_aed", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column(
            "converted_client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("commission_rate", sa.DECIMAL(5, 2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "interest_type IN ('rent','buy','golden_visa','commercial')",
            name="ck_partner_leads_interest",
        ),
        sa.CheckConstraint(
            "status IN ('new','contacted','qualified','converted','lost')",
            name="ck_partner_leads_status",
        ),
    )
    op.create_index("idx_partner_leads_company", "partner_leads", ["company_id"])
    op.create_index("idx_partner_leads_submitter", "partner_leads", ["submitter_user_id"])
    op.create_index("idx_partner_leads_status", "partner_leads", ["status"])
    _enable_rls("partner_leads")

    # ── partner_commission_entries ────────────────────────────────────────
    op.create_table(
        "partner_commission_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "partner_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_id", UUID(as_uuid=True), nullable=False),
        sa.Column("base_amount_aed", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("commission_rate", sa.DECIMAL(5, 2), nullable=False),
        sa.Column("commission_amount_aed", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "finance_transaction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("finance_transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "source_type IN ('lead','mandate','service','submission')",
            name="ck_partner_commission_source",
        ),
        sa.CheckConstraint(
            "status IN ('pending','payable','paid','cancelled')",
            name="ck_partner_commission_status",
        ),
    )
    op.create_index(
        "idx_partner_commission_company", "partner_commission_entries", ["company_id"]
    )
    op.create_index(
        "idx_partner_commission_partner", "partner_commission_entries", ["partner_user_id"]
    )
    op.create_index(
        "idx_partner_commission_status", "partner_commission_entries", ["status"]
    )
    _enable_rls("partner_commission_entries")

    # ── partner_services ──────────────────────────────────────────────────
    op.create_table(
        "partner_services",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "partner_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("service_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("fee_aed", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "service_type IN ('notary','bank','insurance','legal','translation','valuation','other')",
            name="ck_partner_services_type",
        ),
    )
    op.create_index("idx_partner_services_company", "partner_services", ["company_id"])
    op.create_index("idx_partner_services_partner", "partner_services", ["partner_user_id"])
    op.create_index("idx_partner_services_type", "partner_services", ["service_type"])
    _enable_rls("partner_services")

    # Triggers updated_at sur les tables avec ce champ
    for tbl in (
        "visit_requests",
        "property_submissions",
        "partner_leads",
        "partner_commission_entries",
        "partner_services",
    ):
        op.execute(
            f"""
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            """
        )


def downgrade() -> None:
    for tbl in (
        "visit_requests",
        "property_submissions",
        "partner_leads",
        "partner_commission_entries",
        "partner_services",
    ):
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at ON {tbl}")

    for tbl in reversed(_RLS_TABLES):
        op.drop_table(tbl)
