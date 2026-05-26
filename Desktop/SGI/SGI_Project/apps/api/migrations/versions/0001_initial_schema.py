"""Initial schema — toutes les tables + RLS + index PostGIS.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-26

Lois architecturales appliquées :
- Loi 1 : company_id + RLS sur toutes les tables métier
- Loi 2 : location GEOMETRY(Point, 4326) + index GIST sur properties
- IDs UUID v4 (gen_random_uuid)
- Soft delete : deleted_at TIMESTAMPTZ nullable
- Montants : DECIMAL(15,2) AED
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extension PostGIS ──────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ── companies ─────────────────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id",         UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name",       sa.String(255), nullable=False),
        sa.Column("slug",       sa.String(100), nullable=False, unique=True),
        sa.Column("plan",       sa.String(50),  nullable=False, server_default="pro"),
        sa.Column("is_active",  sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── users ─────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",              UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",      UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("email",           sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.Text(), nullable=False),
        sa.Column("full_name",       sa.String(255), nullable=False),
        sa.Column("role",            sa.String(50), nullable=False, server_default="agent"),
        sa.Column("is_active",       sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",      sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at",      sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_users_company", "users", ["company_id"])
    op.create_index("idx_users_email",   "users", ["email"])

    # ── clients ───────────────────────────────────────────────────────────
    op.create_table(
        "clients",
        sa.Column("id",                     UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",             UUID(as_uuid=True), nullable=False),
        sa.Column("type",                   sa.String(20), nullable=False),
        sa.Column("first_name",             sa.String(150), nullable=True),
        sa.Column("last_name",              sa.String(150), nullable=True),
        sa.Column("company_name",           sa.String(255), nullable=True),
        sa.Column("email",                  sa.String(255), nullable=True),
        sa.Column("phone",                  sa.String(50),  nullable=True),
        sa.Column("phone2",                 sa.String(50),  nullable=True),
        sa.Column("nationality",            sa.String(100), nullable=True),
        sa.Column("country_of_residence",   sa.String(100), nullable=True),
        sa.Column("source",                 sa.String(50),  nullable=True),
        sa.Column("budget_min",             sa.DECIMAL(15, 2), nullable=True),
        sa.Column("budget_max",             sa.DECIMAL(15, 2), nullable=True),
        sa.Column("preferred_property_type",sa.String(50),  nullable=True),
        sa.Column("preferred_location",     sa.String(150), nullable=True),
        sa.Column("notes",                  sa.Text(), nullable=True),
        sa.Column("assigned_agent_id",      UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",             sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",             sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at",             sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_clients_company", "clients", ["company_id"])
    op.create_index("idx_clients_email",   "clients", ["email"])

    # RLS — clients
    op.execute("ALTER TABLE clients ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON clients
        USING (company_id = current_setting('app.current_company_id')::UUID)
    """)

    # ── properties ────────────────────────────────────────────────────────
    op.create_table(
        "properties",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",     UUID(as_uuid=True), nullable=False),
        sa.Column("reference",      sa.String(50), nullable=False, unique=True),
        sa.Column("type",           sa.String(50), nullable=False),
        sa.Column("title_ar",       sa.String(300), nullable=True),
        sa.Column("title_en",       sa.String(300), nullable=True),
        sa.Column("title_fr",       sa.String(300), nullable=True),
        sa.Column("description_ar", sa.Text(), nullable=True),
        sa.Column("description_en", sa.Text(), nullable=True),
        sa.Column("description_fr", sa.Text(), nullable=True),
        sa.Column("price",          sa.DECIMAL(15, 2), nullable=False),
        sa.Column("area_sqm",       sa.DECIMAL(10, 2), nullable=True),
        sa.Column("bedrooms",       sa.Integer(), nullable=True),
        sa.Column("bathrooms",      sa.Integer(), nullable=True),
        sa.Column("status",         sa.String(30), nullable=False, server_default="available"),
        sa.Column("location",       Geometry("POINT", srid=4326), nullable=True),
        sa.Column("address_en",     sa.String(300), nullable=True),
        sa.Column("address_ar",     sa.String(300), nullable=True),
        sa.Column("district",       sa.String(150), nullable=True),
        sa.Column("city",           sa.String(100), nullable=False, server_default="Dubai"),
        sa.Column("developer",      sa.String(200), nullable=True),
        sa.Column("year_built",     sa.Integer(), nullable=True),
        sa.Column("floor",          sa.Integer(), nullable=True),
        sa.Column("total_floors",   sa.Integer(), nullable=True),
        sa.Column("furnished",      sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("parking_spaces", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amenities",      JSONB(), nullable=False, server_default="'[]'::jsonb"),
        sa.Column("images",         JSONB(), nullable=False, server_default="'[]'::jsonb"),
        sa.Column("is_featured",    sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("views_count",    sa.Integer(), nullable=False, server_default="0"),
        sa.Column("agent_id",       UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at",     sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_properties_company",  "properties", ["company_id"])
    op.create_index("idx_properties_status",   "properties", ["status"])
    op.create_index("idx_properties_type",     "properties", ["type"])
    # Loi 2 — index GIST obligatoire
    op.execute("CREATE INDEX idx_properties_location_gist ON properties USING GIST (location)")

    op.execute("ALTER TABLE properties ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON properties
        USING (company_id = current_setting('app.current_company_id')::UUID)
    """)

    # ── crm_leads ─────────────────────────────────────────────────────────
    op.create_table(
        "crm_leads",
        sa.Column("id",                   UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",           UUID(as_uuid=True), nullable=False),
        sa.Column("client_id",            UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("agent_id",             UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status",               sa.String(30), nullable=False, server_default="new"),
        sa.Column("source",               sa.String(50), nullable=True),
        sa.Column("budget",               sa.DECIMAL(15, 2), nullable=True),
        sa.Column("property_type",        sa.String(50), nullable=True),
        sa.Column("preferred_location",   sa.String(150), nullable=True),
        sa.Column("preferred_property_id",UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="SET NULL"), nullable=True),
        sa.Column("golden_visa_eligible", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("score",                sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_rate",        sa.DECIMAL(5, 2), nullable=False, server_default="0"),
        sa.Column("contact_attempts",     sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_contact_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_action_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_action_type",     sa.String(50), nullable=True),
        sa.Column("lost_reason",          sa.String(150), nullable=True),
        sa.Column("won_amount",           sa.DECIMAL(15, 2), nullable=True),
        sa.Column("notes",                sa.Text(), nullable=True),
        sa.Column("created_at",           sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",           sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at",           sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_crm_leads_company", "crm_leads", ["company_id"])
    op.create_index("idx_crm_leads_status",  "crm_leads", ["status"])
    op.create_index("idx_crm_leads_agent",   "crm_leads", ["agent_id"])

    op.execute("ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON crm_leads
        USING (company_id = current_setting('app.current_company_id')::UUID)
    """)

    # ── crm_activities ────────────────────────────────────────────────────
    op.create_table(
        "crm_activities",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",   UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id",      UUID(as_uuid=True), sa.ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id",      UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type",         sa.String(50), nullable=False),
        sa.Column("content",      sa.Text(), nullable=True),
        sa.Column("status_from",  sa.String(30), nullable=True),
        sa.Column("status_to",    sa.String(30), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_crm_activities_lead",    "crm_activities", ["lead_id"])
    op.create_index("idx_crm_activities_company", "crm_activities", ["company_id"])

    op.execute("ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON crm_activities
        USING (company_id = current_setting('app.current_company_id')::UUID)
    """)

    # ── contracts ─────────────────────────────────────────────────────────
    op.create_table(
        "contracts",
        sa.Column("id",                UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",        UUID(as_uuid=True), nullable=False),
        sa.Column("reference",         sa.String(50), nullable=False, unique=True),
        sa.Column("type",              sa.String(20), nullable=False),
        sa.Column("client_id",         UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("property_id",       UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("agent_id",          UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount",            sa.DECIMAL(15, 2), nullable=False),
        sa.Column("commission_rate",   sa.DECIMAL(5, 2), nullable=False, server_default="2.0"),
        sa.Column("commission_amount", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("status",            sa.String(30), nullable=False, server_default="draft"),
        sa.Column("signed_at",         sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_date",        sa.Date(), nullable=True),
        sa.Column("end_date",          sa.Date(), nullable=True),
        sa.Column("notes_ar",          sa.Text(), nullable=True),
        sa.Column("notes_en",          sa.Text(), nullable=True),
        sa.Column("notes_fr",          sa.Text(), nullable=True),
        sa.Column("documents",         JSONB(), nullable=False, server_default="'[]'::jsonb"),
        sa.Column("metadata",          JSONB(), nullable=False, server_default="'{}'::jsonb"),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",        sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at",        sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_contracts_company",  "contracts", ["company_id"])
    op.create_index("idx_contracts_client",   "contracts", ["client_id"])
    op.create_index("idx_contracts_property", "contracts", ["property_id"])
    op.create_index("idx_contracts_status",   "contracts", ["status"])

    op.execute("ALTER TABLE contracts ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON contracts
        USING (company_id = current_setting('app.current_company_id')::UUID)
    """)

    # ── rentals ───────────────────────────────────────────────────────────
    op.create_table(
        "rentals",
        sa.Column("id",                UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",        UUID(as_uuid=True), nullable=False),
        sa.Column("contract_id",       UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("client_id",         UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("property_id",       UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("monthly_rent",      sa.DECIMAL(15, 2), nullable=False),
        sa.Column("annual_rent",       sa.DECIMAL(15, 2), nullable=False),
        sa.Column("deposit",           sa.DECIMAL(15, 2), nullable=False, server_default="0"),
        sa.Column("payment_frequency", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("status",            sa.String(30), nullable=False, server_default="active"),
        sa.Column("start_date",        sa.Date(), nullable=False),
        sa.Column("end_date",          sa.Date(), nullable=False),
        sa.Column("renewal_alert_sent",sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("payment_schedule",  JSONB(), nullable=False, server_default="'[]'::jsonb"),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",        sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at",        sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_rentals_company",  "rentals", ["company_id"])
    op.create_index("idx_rentals_status",   "rentals", ["status"])
    op.create_index("idx_rentals_end_date", "rentals", ["end_date"])

    op.execute("ALTER TABLE rentals ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON rentals
        USING (company_id = current_setting('app.current_company_id')::UUID)
    """)

    # ── golden_visa_applications ──────────────────────────────────────────
    op.create_table(
        "golden_visa_applications",
        sa.Column("id",                 UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",         UUID(as_uuid=True), nullable=False),
        sa.Column("client_id",          UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("property_id",        UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contract_id",        UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("application_number", sa.String(50), nullable=True),
        sa.Column("status",             sa.String(30), nullable=False, server_default="pending"),
        sa.Column("passport_doc",       sa.String(500), nullable=True),
        sa.Column("dld_doc",            sa.String(500), nullable=True),
        sa.Column("gdrfa_doc",          sa.String(500), nullable=True),
        sa.Column("insurance_doc",      sa.String(500), nullable=True),
        sa.Column("biometric_photo",    sa.String(500), nullable=True),
        sa.Column("submission_date",    sa.Date(), nullable=True),
        sa.Column("approval_date",      sa.Date(), nullable=True),
        sa.Column("visa_expiry_date",   sa.Date(), nullable=True),
        sa.Column("alert_90_sent",      sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("alert_30_sent",      sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notes",              sa.Text(), nullable=True),
        sa.Column("assigned_agent_id",  UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",         sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",         sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at",         sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_gv_company",     "golden_visa_applications", ["company_id"])
    op.create_index("idx_gv_status",      "golden_visa_applications", ["status"])
    op.create_index("idx_gv_expiry",      "golden_visa_applications", ["visa_expiry_date"])

    op.execute("ALTER TABLE golden_visa_applications ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON golden_visa_applications
        USING (company_id = current_setting('app.current_company_id')::UUID)
    """)

    # ── finance_transactions ──────────────────────────────────────────────
    op.create_table(
        "finance_transactions",
        sa.Column("id",                   UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",           UUID(as_uuid=True), nullable=False),
        sa.Column("reference",            sa.String(50), nullable=False, unique=True),
        sa.Column("type",                 sa.String(30), nullable=False),
        sa.Column("direction",            sa.String(10), nullable=False, server_default="debit"),
        sa.Column("amount",               sa.DECIMAL(15, 2), nullable=False),
        sa.Column("currency",             sa.String(3), nullable=False, server_default="AED"),
        sa.Column("status",               sa.String(30), nullable=False, server_default="pending"),
        sa.Column("description_en",       sa.String(500), nullable=True),
        sa.Column("description_ar",       sa.String(500), nullable=True),
        sa.Column("description_fr",       sa.String(500), nullable=True),
        sa.Column("related_contract_id",  UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_client_id",    UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_property_id",  UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="SET NULL"), nullable=True),
        sa.Column("due_date",             sa.Date(), nullable=True),
        sa.Column("paid_at",              sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_method",       sa.String(50), nullable=True),
        sa.Column("bank_reference",       sa.String(150), nullable=True),
        sa.Column("created_at",           sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",           sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at",           sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_fin_company",  "finance_transactions", ["company_id"])
    op.create_index("idx_fin_type",     "finance_transactions", ["type"])
    op.create_index("idx_fin_status",   "finance_transactions", ["status"])
    op.create_index("idx_fin_due",      "finance_transactions", ["due_date"])

    op.execute("ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON finance_transactions
        USING (company_id = current_setting('app.current_company_id')::UUID)
    """)

    # ── audit_logs (exempté RLS) ──────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id",  UUID(as_uuid=True), nullable=False),
        sa.Column("user_id",     UUID(as_uuid=True), nullable=True),
        sa.Column("user_email",  sa.String(255), nullable=True),
        sa.Column("action",      sa.String(100), nullable=False),
        sa.Column("resource",    sa.String(100), nullable=False),
        sa.Column("resource_id", UUID(as_uuid=True), nullable=True),
        sa.Column("changes",     JSONB(), nullable=False, server_default="'{}'::jsonb"),
        sa.Column("ip_address",  sa.String(45), nullable=True),
        sa.Column("user_agent",  sa.String(500), nullable=True),
        sa.Column("request_id",  sa.String(50), nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_audit_company",          "audit_logs", ["company_id"])
    op.create_index("idx_audit_resource",         "audit_logs", ["resource", "resource_id"])
    op.create_index("idx_audit_action_created",   "audit_logs", ["action", "created_at"])

    # ── Trigger updated_at automatique ────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql'
    """)

    for tbl in ["companies", "users", "clients", "properties", "crm_leads",
                "contracts", "rentals", "golden_visa_applications", "finance_transactions"]:
        op.execute(f"""
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        """)


def downgrade() -> None:
    for tbl in ["companies", "users", "clients", "properties", "crm_leads",
                "contracts", "rentals", "golden_visa_applications", "finance_transactions"]:
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at ON {tbl}")

    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")

    op.drop_table("audit_logs")
    op.drop_table("finance_transactions")
    op.drop_table("golden_visa_applications")
    op.drop_table("rentals")
    op.drop_table("contracts")
    op.drop_table("crm_activities")
    op.drop_table("crm_leads")
    op.drop_table("properties")
    op.drop_table("clients")
    op.drop_table("users")
    op.drop_table("companies")
