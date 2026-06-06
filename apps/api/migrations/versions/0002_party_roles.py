"""Profils-rôles RealEstate : owners, tenant_profiles, vendors, technicians.

Revision ID: 0002_party_roles
Revises: 0001_initial_schema
Create Date: 2026-05-28

Approche : on garde `clients` comme table-parapluie (party) et on ajoute
4 tables de profil qui pointent vers elle (sauf `technicians` qui pointe
vers `users` — techniciens internes salariés).

Lois respectées :
- Loi 1 : company_id + index + RLS sur chaque table métier
- Soft delete : deleted_at TIMESTAMPTZ nullable
- IDs FK = PK (1-1 strict avec la party)

Endpoints exposés :
- /api/v1/owners, /api/v1/tenants, /api/v1/vendors, /api/v1/technicians
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0002_party_roles"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


# Tables qui suivent toutes le même cycle de vie (Loi 1 + soft delete + trigger updated_at)
_PARTY_ROLE_TABLES = ("owners", "tenant_profiles", "vendors", "technicians")


def _enable_rls(table: str) -> None:
    """Active RLS + crée la policy d'isolation tenant (Loi 1)."""
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID)
        """
    )


def upgrade() -> None:
    # ── owners ────────────────────────────────────────────────────────────
    op.create_table(
        "owners",
        sa.Column(
            "party_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("residency_uae", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("emirates_id", sa.String(50), nullable=True),
        sa.Column("emirates_id_expiry", sa.Date(), nullable=True),
        sa.Column("passport_number", sa.String(50), nullable=True),
        sa.Column("passport_expiry", sa.Date(), nullable=True),
        sa.Column("mandate_reference", sa.String(50), nullable=True),
        sa.Column("mandate_signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("mandate_start_date", sa.Date(), nullable=True),
        sa.Column("mandate_end_date", sa.Date(), nullable=True),
        sa.Column("mandate_commission_rate", sa.DECIMAL(5, 2), nullable=True),
        sa.Column("mandate_document_path", sa.String(500), nullable=True),
        sa.Column("bank_iban", sa.String(50), nullable=True),
        sa.Column("bank_swift", sa.String(20), nullable=True),
        sa.Column("bank_name", sa.String(200), nullable=True),
        sa.Column(
            "preferred_payout_method",
            sa.String(30),
            nullable=False,
            server_default="bank_transfer",
        ),
        sa.Column(
            "monthly_statement_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column("expense_approval_threshold_aed", sa.DECIMAL(15, 2), nullable=True),
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
    )
    op.create_index("idx_owners_company", "owners", ["company_id"])
    op.create_index("idx_owners_mandate_end", "owners", ["mandate_end_date"])
    op.create_unique_constraint(
        "uq_owners_mandate_reference_company",
        "owners",
        ["company_id", "mandate_reference"],
    )
    _enable_rls("owners")

    # ── tenant_profiles ───────────────────────────────────────────────────
    op.create_table(
        "tenant_profiles",
        sa.Column(
            "party_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "lifecycle_status",
            sa.String(20),
            nullable=False,
            server_default="candidate",
        ),
        sa.Column("emirates_id", sa.String(50), nullable=True),
        sa.Column("emirates_id_expiry", sa.Date(), nullable=True),
        sa.Column("passport_number", sa.String(50), nullable=True),
        sa.Column("passport_expiry", sa.Date(), nullable=True),
        sa.Column("visa_number", sa.String(50), nullable=True),
        sa.Column("visa_expiry", sa.Date(), nullable=True),
        sa.Column("visa_type", sa.String(30), nullable=True),
        sa.Column("monthly_income_aed", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("employer_name", sa.String(255), nullable=True),
        sa.Column("employer_phone", sa.String(50), nullable=True),
        sa.Column("emergency_contact_name", sa.String(200), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(50), nullable=True),
        sa.Column("emergency_contact_relation", sa.String(50), nullable=True),
        sa.Column("loyalty_score", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("candidacy_submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("candidacy_approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blacklisted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blacklist_reason", sa.String(500), nullable=True),
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
            "lifecycle_status IN ('candidate','active','former','blacklisted')",
            name="ck_tenant_profiles_lifecycle",
        ),
        sa.CheckConstraint(
            "loyalty_score BETWEEN 0 AND 100",
            name="ck_tenant_profiles_loyalty_range",
        ),
    )
    op.create_index("idx_tenants_company", "tenant_profiles", ["company_id"])
    op.create_index("idx_tenants_lifecycle", "tenant_profiles", ["lifecycle_status"])
    op.create_index("idx_tenants_visa_expiry", "tenant_profiles", ["visa_expiry"])
    _enable_rls("tenant_profiles")

    # ── vendors ───────────────────────────────────────────────────────────
    op.create_table(
        "vendors",
        sa.Column(
            "party_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("vendor_type", sa.String(30), nullable=False),
        sa.Column("specialities", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("service_areas", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("trade_licence_number", sa.String(50), nullable=True),
        sa.Column("trade_licence_expiry", sa.Date(), nullable=True),
        sa.Column("trade_licence_authority", sa.String(100), nullable=True),
        sa.Column("insurance_policy_number", sa.String(100), nullable=True),
        sa.Column("insurance_expiry", sa.Date(), nullable=True),
        sa.Column("rating_avg", sa.DECIMAL(3, 2), nullable=False, server_default="0"),
        sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_time_hours_avg", sa.DECIMAL(5, 2), nullable=True),
        sa.Column("on_time_rate", sa.DECIMAL(5, 2), nullable=True),
        sa.Column("jobs_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("jobs_cancelled", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("preferred_payment_terms", sa.String(30), nullable=True),
        sa.Column(
            "emergency_24_7", sa.Boolean(), nullable=False, server_default="false"
        ),
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
            "vendor_type IN ('maintenance','cleaning','security','landscaping',"
            "'pest_control','elevator','moving','hvac','electrical','plumbing','other')",
            name="ck_vendors_type",
        ),
        sa.CheckConstraint(
            "rating_avg BETWEEN 0 AND 5", name="ck_vendors_rating_range"
        ),
    )
    op.create_index("idx_vendors_company", "vendors", ["company_id"])
    op.create_index("idx_vendors_type", "vendors", ["vendor_type"])
    op.create_index("idx_vendors_rating", "vendors", ["rating_avg"])
    op.create_index(
        "idx_vendors_licence_expiry", "vendors", ["trade_licence_expiry"]
    )
    op.create_unique_constraint(
        "uq_vendors_licence_company",
        "vendors",
        ["company_id", "trade_licence_number"],
    )
    _enable_rls("vendors")

    # ── technicians ───────────────────────────────────────────────────────
    op.create_table(
        "technicians",
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("skills", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "assigned_zones", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column("rating_avg", sa.DECIMAL(3, 2), nullable=False, server_default="0"),
        sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("jobs_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_resolution_hours", sa.DECIMAL(6, 2), nullable=True),
        sa.Column(
            "mobile_active", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column("on_call", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("emergency_contact_phone", sa.String(50), nullable=True),
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
            "rating_avg BETWEEN 0 AND 5", name="ck_technicians_rating_range"
        ),
    )
    op.create_index("idx_technicians_company", "technicians", ["company_id"])
    op.create_index(
        "idx_technicians_mobile_active", "technicians", ["mobile_active"]
    )
    _enable_rls("technicians")

    # Trigger updated_at — réutilise la fonction créée en 0001
    for tbl in _PARTY_ROLE_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            """
        )


def downgrade() -> None:
    for tbl in _PARTY_ROLE_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at ON {tbl}")

    op.drop_table("technicians")
    op.drop_table("vendors")
    op.drop_table("tenant_profiles")
    op.drop_table("owners")
