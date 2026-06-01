"""Index company_id sur les tables enfant (conformité Loi 1).

Revision ID: 0029_child_company_indexes
Revises: 0028_notifications_type_index
Create Date: 2026-06-02

Les tables enfant des modules comms / workflows / inspections portent bien
`company_id NOT NULL` + RLS, mais n'avaient pas d'index mené par `company_id`
(seulement sur la FK parent). On ajoute `idx_{t}_company` pour aligner sur la
lettre de la Loi 1 (idx_{t}_company) — utile pour les purges / audits par société.
"""

from alembic import op


revision = "0029_child_company_indexes"
down_revision = "0028_notifications_type_index"
branch_labels = None
depends_on = None


# (nom_index, table, colonne)
_INDEXES = [
    ("idx_conv_participants_company", "conversation_participants", "company_id"),
    ("idx_conv_msgs_company", "conversation_messages", "company_id"),
    ("idx_mentions_company", "message_mentions", "company_id"),
    ("idx_wf_steps_company", "workflow_steps", "company_id"),
    ("idx_wf_events_company", "workflow_events", "company_id"),
    ("idx_insp_sections_company", "inspection_sections", "company_id"),
    ("idx_insp_items_company", "inspection_items", "company_id"),
    ("idx_insp_photos_company", "inspection_photos", "company_id"),
]


def upgrade() -> None:
    for name, table, col in _INDEXES:
        op.create_index(name, table, [col])


def downgrade() -> None:
    for name, table, _col in reversed(_INDEXES):
        op.drop_index(name, table_name=table)
