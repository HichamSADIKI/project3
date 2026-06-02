"""Omnichannel Inbox — conversations multi-canaux + messages + tags + notes.

Revision ID: 0031_omnichannel_inbox
Revises: 0030_merge_telephony_audit
Create Date: 2026-06-02

Centre de contact omnicanal (WhatsApp/Facebook/Instagram/email/webchat) intégré
à la rubrique Communication. Distinct des `conversations` in-app (comms, 0015) :
ici on capture des fils EXTERNES via webhooks, avec dédoublonnage idempotent.

Tables (RLS Loi 1 sur toutes) :
- inbox_conversations    : fil par canal externe (idempotent via external_thread_id)
- inbox_messages         : messages entrants/sortants (dédup external_message_id)
- inbox_tags             : tags réutilisables par tenant
- inbox_conversation_tags: M2M conversation ↔ tag
- inbox_notes            : notes internes agent (jamais visibles du client)
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0031_omnichannel_inbox"
down_revision = "0030_merge_telephony_audit"
branch_labels = None
depends_on = None

_CHANNELS = "'whatsapp','facebook','instagram','email','webchat'"
_STATUSES = "'new','assigned','pending','resolved','closed'"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── inbox_conversations ──────────────────────────────────────────────
    op.create_table(
        "inbox_conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("external_thread_id", sa.String(255), nullable=True),
        sa.Column("client_id", UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_agent_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("subject", sa.String(255), nullable=True),
        sa.Column("contact_display", sa.String(255), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("channel_metadata", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_inbox_conv_channel", "inbox_conversations",
                               f"channel IN ({_CHANNELS})")
    op.create_check_constraint("ck_inbox_conv_status", "inbox_conversations",
                               f"status IN ({_STATUSES})")
    op.create_index("idx_inbox_conv_company", "inbox_conversations", ["company_id"])
    op.create_index("idx_inbox_conv_company_status", "inbox_conversations",
                    ["company_id", "status"])
    op.create_index("idx_inbox_conv_company_agent", "inbox_conversations",
                    ["company_id", "assigned_agent_id"])
    op.create_index("idx_inbox_conv_last_msg", "inbox_conversations",
                    ["company_id", "last_message_at"])
    # Idempotence webhook : un fil externe = une conversation par tenant+canal.
    op.create_index("uq_inbox_conv_thread", "inbox_conversations",
                    ["company_id", "channel", "external_thread_id"], unique=True,
                    postgresql_where=sa.text("external_thread_id IS NOT NULL"))
    op.create_index("uq_inbox_conv_reference", "inbox_conversations",
                    ["company_id", "reference"], unique=True)
    _rls("inbox_conversations")

    # ── inbox_messages ───────────────────────────────────────────────────
    op.create_table(
        "inbox_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", UUID(as_uuid=True),
                  sa.ForeignKey("inbox_conversations.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("external_message_id", sa.String(255), nullable=True),
        sa.Column("sender_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("raw_payload", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint("ck_inbox_msg_direction", "inbox_messages",
                               "direction IN ('inbound','outbound')")
    op.create_index("idx_inbox_msg_company", "inbox_messages", ["company_id"])
    op.create_index("idx_inbox_msg_conv", "inbox_messages",
                    ["company_id", "conversation_id"])
    # Dédoublonnage des webhooks : un message externe traité une seule fois.
    op.create_index("uq_inbox_msg_external", "inbox_messages",
                    ["company_id", "external_message_id"], unique=True,
                    postgresql_where=sa.text("external_message_id IS NOT NULL"))
    _rls("inbox_messages")

    # ── inbox_tags ───────────────────────────────────────────────────────
    op.create_table(
        "inbox_tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_inbox_tags_company", "inbox_tags", ["company_id"])
    op.create_index("uq_inbox_tags_name", "inbox_tags",
                    ["company_id", "name"], unique=True)
    _rls("inbox_tags")

    # ── inbox_conversation_tags (M2M) ────────────────────────────────────
    op.create_table(
        "inbox_conversation_tags",
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", UUID(as_uuid=True),
                  sa.ForeignKey("inbox_conversations.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("tag_id", UUID(as_uuid=True),
                  sa.ForeignKey("inbox_tags.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_inbox_conv_tags_company", "inbox_conversation_tags",
                    ["company_id"])
    _rls("inbox_conversation_tags")

    # ── inbox_notes ──────────────────────────────────────────────────────
    op.create_table(
        "inbox_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", UUID(as_uuid=True),
                  sa.ForeignKey("inbox_conversations.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("agent_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_inbox_notes_company", "inbox_notes", ["company_id"])
    op.create_index("idx_inbox_notes_conv", "inbox_notes",
                    ["company_id", "conversation_id"])
    _rls("inbox_notes")


def downgrade() -> None:
    for t in ("inbox_notes", "inbox_conversation_tags", "inbox_tags",
              "inbox_messages", "inbox_conversations"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
