"""Documents & Signature — documents génériques + versioning + e-signature UAE.

Revision ID: 0021_documents_signature
Revises: 0020_realestate_core
Create Date: 2026-05-30

Crée :
- documents           (document logique, lien polymorphe entity_type+entity_id)
- document_versions   (versions immuables, sha256, clé MinIO)
- document_signatures (signature interne conforme UAE : hash + OTP + audit)
RLS activé sur les 3 tables (Loi 1).
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0021_documents_signature"
down_revision = "0020_realestate_core"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── documents ────────────────────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("doc_type", sa.String(30), nullable=False, server_default="other"),
        sa.Column("entity_type", sa.String(40), nullable=True),
        sa.Column("entity_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("current_version_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("tags", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_documents_type", "documents",
        "doc_type IN ('contract','mandate','id','passport','ejari','dld',"
        "'insurance','invoice','statement','other')")
    op.create_check_constraint("ck_documents_status", "documents",
        "status IN ('draft','active','signed','archived')")
    op.create_index("idx_documents_company", "documents", ["company_id"])
    op.create_index("idx_documents_entity", "documents",
                    ["company_id", "entity_type", "entity_id"])
    op.create_index("idx_documents_company_type", "documents", ["company_id", "doc_type"])
    op.create_index("idx_documents_company_status", "documents", ["company_id", "status"])
    _rls("documents")

    # ── document_versions ────────────────────────────────────────────────
    op.create_table(
        "document_versions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("size_bytes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("uploaded_by_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_doc_versions_company", "document_versions", ["company_id"])
    op.create_index("uq_doc_versions_doc_number", "document_versions",
                    ["document_id", "version_number"], unique=True)
    _rls("document_versions")

    # ── document_signatures ──────────────────────────────────────────────
    op.create_table(
        "document_signatures",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_version_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("document_versions.id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("signer_party_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("signer_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("signer_name", sa.String(200), nullable=False),
        sa.Column("signer_email", sa.String(200), nullable=True),
        sa.Column("signer_role", sa.String(20), nullable=False, server_default="other"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("signature_hash", sa.String(64), nullable=True),
        sa.Column("method", sa.String(20), nullable=True),
        sa.Column("otp_verified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("provider", sa.String(30), nullable=False, server_default="internal"),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint("ck_doc_sign_role", "document_signatures",
        "signer_role IN ('owner','tenant','agent','witness','other')")
    op.create_check_constraint("ck_doc_sign_status", "document_signatures",
        "status IN ('pending','signed','declined','expired')")
    op.create_index("idx_doc_sign_company", "document_signatures", ["company_id"])
    op.create_index("idx_doc_sign_document", "document_signatures", ["document_id"])
    op.create_index("idx_doc_sign_company_status", "document_signatures",
                    ["company_id", "status"])
    _rls("document_signatures")


def downgrade() -> None:
    for t in ("document_signatures", "document_versions", "documents"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
