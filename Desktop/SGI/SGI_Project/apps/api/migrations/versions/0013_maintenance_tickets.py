"""Phase ERP — Module Maintenance : table maintenance_tickets.

Revision ID: 0013_maintenance_tickets
Revises: 0012_vendor_categories
Create Date: 2026-05-30

Crée la table `maintenance_tickets` avec :
- RLS multi-tenant (Loi 1)
- référence MNT-YYYY-NNNNNN unique par tenant
- index composites (company_id+status, company_id+priority, sla_due_at)
- check constraints (category, priority, status, reporter_role, localisation)
"""
from alembic import op
import sqlalchemy as sa


revision = "0013_maintenance_tickets"
down_revision = "0012_vendor_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "maintenance_tickets",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),

        # Référence lisible unique par tenant.
        sa.Column("reference", sa.String(20), nullable=False),

        # Localisation (au moins une obligatoire — check constraint ci-dessous).
        sa.Column("unit_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("units.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("building_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("buildings.id", ondelete="RESTRICT"), nullable=True),

        # Déclarant.
        sa.Column("reported_by_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("reporter_role", sa.String(20), nullable=False, server_default="agent"),

        # Classification.
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),

        # Contenu.
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),

        # Assignation technicien interne.
        sa.Column("assigned_technician_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),

        # Assignation vendor externe + mission liée.
        sa.Column("assigned_vendor_party_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("vendor_mission_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("vendor_missions.id", ondelete="RESTRICT"), nullable=True),

        # SLA.
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),

        # Coûts AED.
        sa.Column("cost_estimate_aed", sa.Numeric(15, 2), nullable=True),
        sa.Column("cost_final_aed", sa.Numeric(15, 2), nullable=True),

        # Timestamps standards + soft delete.
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Check constraints ─────────────────────────────────────────────────
    op.create_check_constraint(
        "ck_maintenance_tickets_location",
        "maintenance_tickets",
        "unit_id IS NOT NULL OR building_id IS NOT NULL",
    )
    op.create_check_constraint(
        "ck_maintenance_tickets_category",
        "maintenance_tickets",
        "category IN ('plumbing','electrical','hvac','appliance','structural','cleaning','other')",
    )
    op.create_check_constraint(
        "ck_maintenance_tickets_priority",
        "maintenance_tickets",
        "priority IN ('low','medium','high','urgent')",
    )
    op.create_check_constraint(
        "ck_maintenance_tickets_status",
        "maintenance_tickets",
        "status IN ('new','triaged','assigned','in_progress','on_hold','resolved','closed','cancelled')",
    )
    op.create_check_constraint(
        "ck_maintenance_tickets_reporter_role",
        "maintenance_tickets",
        "reporter_role IN ('tenant','owner','agent','system')",
    )

    # ── Index ─────────────────────────────────────────────────────────────
    op.create_index("idx_mnt_tickets_company_status",   "maintenance_tickets", ["company_id", "status"])
    op.create_index("idx_mnt_tickets_company_priority", "maintenance_tickets", ["company_id", "priority"])
    op.create_index("idx_mnt_tickets_sla_due_at",       "maintenance_tickets", ["sla_due_at"])
    op.create_index("idx_mnt_tickets_unit",             "maintenance_tickets", ["unit_id"])
    op.create_index("idx_mnt_tickets_building",         "maintenance_tickets", ["building_id"])
    op.create_index("idx_mnt_tickets_technician",       "maintenance_tickets", ["assigned_technician_id"])
    op.create_index(
        "uq_mnt_tickets_company_ref",
        "maintenance_tickets",
        ["company_id", "reference"],
        unique=True,
    )

    # ── RLS multi-tenant (Loi 1) ──────────────────────────────────────────
    op.execute("ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON maintenance_tickets
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON maintenance_tickets;")
    op.drop_table("maintenance_tickets")
