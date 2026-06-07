"""Phase 2 — Espace fournisseur : documents KYC + missions/interventions.

Revision ID: 0011_vendor_docs_missions
Revises: 0010_fournisseur_kyc
Create Date: 2026-05-29

Deux tables rattachées au profil prestataire (`vendors.party_id`) :

  vendor_documents  — pièces KYC du fournisseur (licence commerciale, assurance,
                      TVA, identité…). Chemin MinIO + expiration + extraction OCR.
  vendor_missions   — ordres de mission / interventions confiés par l'agence,
                      avec machine à états (assigned → accepted → in_progress → done
                      | cancelled).

Loi 1 : company_id + index + RLS sur les deux tables.
Soft delete : deleted_at.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "0011_vendor_docs_missions"
down_revision = "0010_fournisseur_kyc"
branch_labels = None
depends_on = None


_RLS_TABLES = ("vendor_documents", "vendor_missions")


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID)
        """
    )


def upgrade() -> None:
    # ── vendor_documents ───────────────────────────────────────────────────
    op.create_table(
        "vendor_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "vendor_party_id",
            UUID(as_uuid=True),
            sa.ForeignKey("vendors.party_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("doc_type", sa.String(30), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column(
            "extracted", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
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
            "doc_type IN ('trade_licence','insurance','vat','id','other')",
            name="ck_vendor_documents_type",
        ),
        sa.CheckConstraint(
            "status IN ('active','expired','replaced')",
            name="ck_vendor_documents_status",
        ),
    )
    op.create_index("idx_vendor_documents_company", "vendor_documents", ["company_id"])
    op.create_index("idx_vendor_documents_vendor", "vendor_documents", ["vendor_party_id"])
    op.create_index("idx_vendor_documents_type", "vendor_documents", ["doc_type"])
    _enable_rls("vendor_documents")

    # ── vendor_missions ────────────────────────────────────────────────────
    op.create_table(
        "vendor_missions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "vendor_party_id",
            UUID(as_uuid=True),
            sa.ForeignKey("vendors.party_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="assigned"),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("location_text", sa.String(255), nullable=True),
        sa.Column("amount_aed", sa.DECIMAL(15, 2), nullable=True),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
            "status IN ('assigned','accepted','in_progress','done','cancelled')",
            name="ck_vendor_missions_status",
        ),
    )
    op.create_index("idx_vendor_missions_company", "vendor_missions", ["company_id"])
    op.create_index("idx_vendor_missions_vendor", "vendor_missions", ["vendor_party_id"])
    op.create_index("idx_vendor_missions_status", "vendor_missions", ["status"])
    _enable_rls("vendor_missions")

    for tbl in _RLS_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            """
        )


def downgrade() -> None:
    for tbl in _RLS_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at ON {tbl}")
    for tbl in reversed(_RLS_TABLES):
        op.drop_table(tbl)
