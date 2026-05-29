"""Phase ERP — Inspections + Check-in/Check-out (Phase 7).

Revision ID: 0018_inspections
Revises: 0017_mfa
Create Date: 2026-05-30

Crée :
- inspections          (état des lieux, machine à états, score global)
- inspection_sections  (sections de l'inspection)
- inspection_items     (items notés par section)
- inspection_photos    (photos MinIO par item)
RLS activé sur les 4 tables (Loi 1).
"""
from alembic import op
import sqlalchemy as sa


revision = "0018_inspections"
down_revision = "0017_mfa"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── inspections ──────────────────────────────────────────────────────
    op.create_table(
        "inspections",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("unit_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("units.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("rental_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("rentals.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("contract_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("inspection_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("scheduled_date", sa.Date, nullable=True),
        sa.Column("inspector_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("tenant_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("owner_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_by", sa.String(255), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("overall_score", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_inspection_type", "inspections",
        "inspection_type IN ('check_in','check_out','periodic','pre_sale')")
    op.create_check_constraint("ck_inspection_status", "inspections",
        "status IN ('draft','scheduled','in_progress','completed','signed','cancelled')")
    op.create_index("idx_inspections_company_status", "inspections", ["company_id", "status"])
    op.create_index("idx_inspections_company_type",   "inspections", ["company_id", "inspection_type"])
    op.create_index("idx_inspections_unit",            "inspections", ["unit_id"])
    op.create_index("uq_inspections_company_ref",      "inspections",
                    ["company_id", "reference"], unique=True)
    _rls("inspections")

    # ── inspection_sections ──────────────────────────────────────────────
    op.create_table(
        "inspection_sections",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("inspection_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("section_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("idx_insp_sections_inspection", "inspection_sections", ["inspection_id"])
    _rls("inspection_sections")

    # ── inspection_items ─────────────────────────────────────────────────
    op.create_table(
        "inspection_items",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("inspection_sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("item_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("condition", sa.String(20), nullable=True),
        sa.Column("score", sa.Integer, nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
    )
    op.create_check_constraint("ck_item_condition", "inspection_items",
        "condition IS NULL OR condition IN ('good','fair','poor','missing','na')")
    op.create_check_constraint("ck_item_score", "inspection_items",
        "score IS NULL OR (score >= 0 AND score <= 5)")
    op.create_index("idx_insp_items_section", "inspection_items", ["section_id"])
    _rls("inspection_items")

    # ── inspection_photos ────────────────────────────────────────────────
    op.create_table(
        "inspection_photos",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("inspection_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_key", sa.String(500), nullable=False),
        sa.Column("caption", sa.String(255), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_insp_photos_item", "inspection_photos", ["item_id"])
    _rls("inspection_photos")


def downgrade() -> None:
    for t in ("inspection_photos", "inspection_items",
              "inspection_sections", "inspections"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
