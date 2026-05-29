"""Phase ERP — Paiements (Phase 8).

Revision ID: 0019_payments
Revises: 0018_inspections
Create Date: 2026-05-30

Crée :
- payment_requests     (demandes de paiement : loyer, charges, payout owner…)
- payment_transactions (transactions réelles liées aux demandes)
RLS activé sur les 2 tables (Loi 1).
"""
from alembic import op
import sqlalchemy as sa


revision = "0019_payments"
down_revision = "0018_inspections"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── payment_requests ─────────────────────────────────────────────────
    op.create_table(
        "payment_requests",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("tenant_client_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("owner_client_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("unit_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("units.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("rental_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("rentals.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("payment_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("amount_aed", sa.Numeric(15, 2), nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_pay_req_type", "payment_requests",
        "payment_type IN ('rent','charges','deposit','deposit_return','owner_payout','other')")
    op.create_check_constraint("ck_pay_req_status", "payment_requests",
        "status IN ('pending','paid','overdue','cancelled')")
    op.create_index("uq_pay_req_company_ref", "payment_requests",
                    ["company_id", "reference"], unique=True)
    op.create_index("idx_pay_req_company_status", "payment_requests", ["company_id", "status"])
    op.create_index("idx_pay_req_due_date", "payment_requests", ["due_date"])
    op.create_index("idx_pay_req_tenant", "payment_requests", ["tenant_client_id"])
    op.create_index("idx_pay_req_owner", "payment_requests", ["owner_client_id"])
    _rls("payment_requests")

    # ── payment_transactions ─────────────────────────────────────────────
    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("payment_requests.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="initiated"),
        sa.Column("method", sa.String(30), nullable=False),
        sa.Column("amount_aed", sa.Numeric(15, 2), nullable=False),
        sa.Column("external_ref", sa.String(255), nullable=True),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint("ck_pay_tx_status", "payment_transactions",
        "status IN ('initiated','settled','failed')")
    op.create_check_constraint("ck_pay_tx_method", "payment_transactions",
        "method IN ('bank_transfer','card','cash','cheque','online')")
    op.create_index("idx_pay_tx_request", "payment_transactions", ["request_id"])
    op.create_index("idx_pay_tx_company_status", "payment_transactions", ["company_id", "status"])
    _rls("payment_transactions")


def downgrade() -> None:
    for t in ("payment_transactions", "payment_requests"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
