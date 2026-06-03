"""Sources — registre d'ingestion multi-source → leads CRM.

Revision ID: 0037_source_imports
Revises: 0036_marketing
Create Date: 2026-06-03

Couche d'ingestion : la table `source_imports` trace chaque enregistrement
ingéré depuis une source externe (contrats, réseaux sociaux, base client,
watcher de portails…). La cible métier reste `CRMLead` (réutilisation) — cette
table NE duplique PAS les leads, elle assure idempotence / provenance / journal
des rejets.

Table (RLS Loi 1) :
- source_imports : reference SRC-YYYY-NNNNNN, source_type (CHECK), status (CHECK),
  external_id (idempotence), FK vers crm_leads / clients (SET NULL), raw_payload.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0039_source_imports"
down_revision = "0038_marketing"
branch_labels = None
depends_on = None

# Valeurs — DOIVENT correspondre EXACTEMENT aux helpers du service (frozensets).
_SOURCE_TYPES = "'contract','social','existing_customer','other'"
_IMPORT_STATUSES = "'imported','duplicate','rejected'"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    op.create_table(
        "source_imports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_channel", sa.String(50), nullable=True),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("dedup_key", sa.String(255), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="imported"),
        sa.Column("reject_reason", sa.String(255), nullable=True),
        sa.Column(
            "created_lead_id",
            UUID(as_uuid=True),
            sa.ForeignKey("crm_leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("raw_payload", JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_source_imports_source_type", "source_imports", f"source_type IN ({_SOURCE_TYPES})"
    )
    op.create_check_constraint(
        "ck_source_imports_status", "source_imports", f"status IN ({_IMPORT_STATUSES})"
    )
    op.create_index("idx_source_imports_company", "source_imports", ["company_id"])
    op.create_index(
        "idx_source_imports_company_type", "source_imports", ["company_id", "source_type"]
    )
    op.create_index(
        "uq_source_imports_reference", "source_imports", ["company_id", "reference"], unique=True
    )
    # Idempotence : un même external_id (par tenant + source_type) ne crée qu'une
    # ligne. Index UNIQUE PARTIEL (external_id non nul) → catch IntegrityError côté
    # service relit le gagnant (race-safe).
    op.create_index(
        "uq_source_imports_external",
        "source_imports",
        ["company_id", "source_type", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )
    _rls("source_imports")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON source_imports;")
    op.drop_table("source_imports")
