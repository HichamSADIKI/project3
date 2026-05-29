"""Phase ERP — Maintenance Phase 2 : quotes, invoices, plans préventifs.

Revision ID: 0014_maintenance_quotes_invoices_plans
Revises: 0013_maintenance_tickets
Create Date: 2026-05-30

Crée :
- maintenance_quotes   (devis vendor, pending→approved/rejected/expired)
- maintenance_invoices (factures, draft→issued→paid/overdue, lien finance)
- maintenance_plans    (préventif, cron, next_due_at)
RLS activé sur les 3 tables (Loi 1).
"""
from alembic import op
import sqlalchemy as sa


revision = "0014_mnt_quotes_invoices_plans"
down_revision = "0013_maintenance_tickets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── maintenance_quotes ────────────────────────────────────────────────
    op.create_table(
        "maintenance_quotes",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("maintenance_tickets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vendor_party_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount_aed", sa.Numeric(15, 2), nullable=False),
        sa.Column("valid_until", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("file_key", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_mnt_quotes_status", "maintenance_quotes",
        "status IN ('pending','approved','rejected','expired')",
    )
    op.create_index("idx_mnt_quotes_ticket", "maintenance_quotes", ["ticket_id"])
    op.create_index("idx_mnt_quotes_company_status", "maintenance_quotes", ["company_id", "status"])
    op.execute("ALTER TABLE maintenance_quotes ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON maintenance_quotes
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)

    # ── maintenance_invoices ──────────────────────────────────────────────
    op.create_table(
        "maintenance_invoices",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("maintenance_tickets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vendor_party_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount_aed", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("finance_transaction_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("finance_transactions.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("file_key", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_mnt_invoices_status", "maintenance_invoices",
        "status IN ('draft','issued','paid','overdue')",
    )
    op.create_index("idx_mnt_invoices_ticket", "maintenance_invoices", ["ticket_id"])
    op.create_index("idx_mnt_invoices_company_status", "maintenance_invoices", ["company_id", "status"])
    op.execute("ALTER TABLE maintenance_invoices ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON maintenance_invoices
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)

    # ── maintenance_plans ─────────────────────────────────────────────────
    op.create_table(
        "maintenance_plans",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("unit_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("units.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("building_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("buildings.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("cron_expression", sa.String(100), nullable=False),
        sa.Column("next_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_mnt_plans_location", "maintenance_plans",
        "unit_id IS NOT NULL OR building_id IS NOT NULL",
    )
    op.create_check_constraint(
        "ck_mnt_plans_category", "maintenance_plans",
        "category IN ('plumbing','electrical','hvac','appliance','structural','cleaning','other')",
    )
    op.create_check_constraint(
        "ck_mnt_plans_priority", "maintenance_plans",
        "priority IN ('low','medium','high','urgent')",
    )
    op.create_index("idx_mnt_plans_company_active", "maintenance_plans", ["company_id", "active"])
    op.create_index("idx_mnt_plans_next_due", "maintenance_plans", ["next_due_at"])
    op.execute("ALTER TABLE maintenance_plans ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON maintenance_plans
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def downgrade() -> None:
    for t in ("maintenance_plans", "maintenance_invoices", "maintenance_quotes"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
