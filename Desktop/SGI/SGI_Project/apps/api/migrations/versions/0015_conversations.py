"""Phase ERP — Communication Phase 3 : conversations, participants, messages, mentions.

Revision ID: 0015_conversations
Revises: 0014_mnt_quotes_invoices_plans
Create Date: 2026-05-30

Crée :
- conversations            (thread de communication, lié ticket/contrat)
- conversation_participants (membres + curseur de lecture)
- conversation_messages     (texte, voix, système ; reply_to auto-ref)
- message_mentions          (mentions @user)
RLS activé sur les 4 tables (Loi 1).
La table `messages` existante est conservée sans modification.
"""
from alembic import op
import sqlalchemy as sa


revision = "0015_conversations"
down_revision = "0014_mnt_quotes_invoices_plans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── conversations ────────────────────────────────────────────────────
    op.create_table(
        "conversations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(20), nullable=False, server_default="direct"),
        sa.Column("subject", sa.String(255), nullable=True),
        sa.Column("maintenance_ticket_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("maintenance_tickets.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("contract_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_by", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_conversations_type", "conversations",
        "type IN ('direct','group','ticket','contract')",
    )
    op.create_index("idx_convs_company_type",  "conversations", ["company_id", "type"])
    op.create_index("idx_convs_ticket",        "conversations", ["maintenance_ticket_id"])
    op.create_index("idx_convs_contract",      "conversations", ["contract_id"])
    op.create_index("idx_convs_last_msg",      "conversations", ["company_id", "last_message_at"])
    op.execute("ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON conversations
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)

    # ── conversation_participants ────────────────────────────────────────
    op.create_table(
        "conversation_participants",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("muted", sa.Boolean, nullable=False, server_default="false"),
    )
    op.create_check_constraint(
        "ck_conv_participant_role", "conversation_participants",
        "role IN ('admin','member')",
    )
    op.create_unique_constraint(
        "uq_conv_participant", "conversation_participants", ["conversation_id", "user_id"]
    )
    op.create_index("idx_conv_participants_conv",  "conversation_participants", ["conversation_id"])
    op.create_index("idx_conv_participants_user",  "conversation_participants", ["user_id"])
    op.execute("ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON conversation_participants
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)

    # ── conversation_messages ────────────────────────────────────────────
    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False, server_default="text"),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("attachment_key", sa.String(500), nullable=True),
        sa.Column("transcript", sa.Text, nullable=True),
        sa.Column("transcript_lang", sa.String(10), nullable=True),
        sa.Column("reply_to_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("conversation_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_conv_msg_kind", "conversation_messages",
        "kind IN ('text','voice','system')",
    )
    op.create_check_constraint(
        "ck_conv_msg_content", "conversation_messages",
        "body IS NOT NULL OR attachment_key IS NOT NULL",
    )
    op.create_index(
        "idx_conv_msgs_conv_created", "conversation_messages",
        ["conversation_id", "created_at"]
    )
    op.create_index("idx_conv_msgs_sender", "conversation_messages", ["sender_user_id"])
    op.execute("ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON conversation_messages
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)

    # ── message_mentions ─────────────────────────────────────────────────
    op.create_table(
        "message_mentions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("conversation_messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mentioned_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_unique_constraint(
        "uq_mention", "message_mentions", ["message_id", "mentioned_user_id"]
    )
    op.create_index("idx_mentions_msg",  "message_mentions", ["message_id"])
    op.create_index("idx_mentions_user", "message_mentions", ["mentioned_user_id"])
    op.execute("ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON message_mentions
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def downgrade() -> None:
    for t in ("message_mentions", "conversation_messages",
              "conversation_participants", "conversations"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
