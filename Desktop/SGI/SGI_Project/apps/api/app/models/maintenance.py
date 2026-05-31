"""
MaintenanceTicket — ticket de maintenance SGI.

Un ticket :
- est rattaché à une unit (logement) ou un building (partie commune).
- a une priorité et un SLA calculé à la création.
- est assigné à un technicien interne (users) OU à un vendor externe
  (party vendor → crée automatiquement une vendor_mission).
- traverse la machine à états :
    new → triaged → assigned → in_progress → resolved → closed (terminal)
                        │            └→ on_hold → in_progress
                        └→ cancelled (terminal, depuis tout état non-terminal)
- génère une référence lisible : MNT-YYYY-NNNNNN.

Loi 1 : company_id NOT NULL sur toutes les tables. RLS en migration.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DECIMAL,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class MaintenanceTicket(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Ticket de demande ou d'intervention de maintenance."""

    __tablename__ = "maintenance_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Référence lisible — MNT-YYYY-NNNNNN (6 chiffres, triable).
    reference: Mapped[str] = mapped_column(String(20), nullable=False)

    # ── Localisation ──────────────────────────────────────────────────
    # L'un des deux doit être renseigné (vérifié par check constraint).
    unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("units.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    building_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("buildings.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # ── Déclarant ─────────────────────────────────────────────────────
    reported_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reporter_role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="agent"
    )  # tenant | owner | agent | system

    # ── Classification ────────────────────────────────────────────────
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    # plumbing | electrical | hvac | appliance | structural | cleaning | other

    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    # low | medium | high | urgent

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    # new | triaged | assigned | in_progress | on_hold | resolved | closed | cancelled

    # ── Contenu ───────────────────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Assignation ───────────────────────────────────────────────────
    # Technicien interne (users) OU vendor externe — jamais les deux.
    assigned_technician_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    assigned_vendor_party_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    # vendor_mission créée automatiquement à l'assignation d'un vendor.
    vendor_mission_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendor_missions.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # ── SLA ───────────────────────────────────────────────────────────
    sla_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Coûts ─────────────────────────────────────────────────────────
    cost_estimate_aed: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    cost_final_aed: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)

    __table_args__ = (
        # Au moins une localisation doit être définie.
        CheckConstraint(
            "unit_id IS NOT NULL OR building_id IS NOT NULL",
            name="ck_maintenance_tickets_location",
        ),
        CheckConstraint(
            "category IN ('plumbing','electrical','hvac','appliance',"
            "'structural','cleaning','other')",
            name="ck_maintenance_tickets_category",
        ),
        CheckConstraint(
            "priority IN ('low','medium','high','urgent')",
            name="ck_maintenance_tickets_priority",
        ),
        CheckConstraint(
            "status IN ('new','triaged','assigned','in_progress',"
            "'on_hold','resolved','closed','cancelled')",
            name="ck_maintenance_tickets_status",
        ),
        CheckConstraint(
            "reporter_role IN ('tenant','owner','agent','system')",
            name="ck_maintenance_tickets_reporter_role",
        ),
        # Index composite pour les filtres les plus fréquents.
        Index("idx_mnt_tickets_company_status", "company_id", "status"),
        Index("idx_mnt_tickets_company_priority", "company_id", "priority"),
        Index("uq_mnt_tickets_company_ref", "company_id", "reference", unique=True),
    )
