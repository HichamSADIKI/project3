import uuid
from datetime import datetime

from sqlalchemy import DECIMAL, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class CRMLead(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """
    Lead CRM — pipeline de vente / location.
    Transitions valides (CLAUDE.md) :
      new → contacted → qualified → proposal_sent
      proposal_sent → visit_planned | negotiation | lost
      visit_planned → visit_done | lost
      visit_done → negotiation | proposal_sent | lost
      negotiation → won | lost
      won, lost → terminal
    Score 0-100 calculé automatiquement par le service CRM.
    RLS actif via company_id (TenantMixin).
    """

    __tablename__ = "crm_leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Code métier lisible — format CRM-YYYY-NNNNNN, unique par tenant.
    # Généré à la création (cf. service.generate_reference). Affiché dans la
    # liste des deals du back-office. Index unique composite (company_id,
    # reference) défini en migration 0009.
    reference: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relations principales
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Pipeline
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="new")
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Secteur métier — route le lead vers le pipeline sectoriel correspondant.
    # Valeurs autorisées : realestate, tourisme, sante, assurance, banques,
    # amazon, consultants, admin, travail (cf. migration 0007).
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="realestate")

    # Budget AED
    budget: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)

    # Préférences
    property_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferred_location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    preferred_property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Golden Visa UAE
    golden_visa_eligible: Mapped[bool] = mapped_column(nullable=False, default=False)

    # Scoring automatique (0-100)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    response_rate: Mapped[float] = mapped_column(DECIMAL(5, 2), nullable=False, default=0.0)

    # Suivi des relances (séquence max 4 tentatives / 7 jours)
    contact_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_contact_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_action_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Résultat final
    lost_reason: Mapped[str | None] = mapped_column(String(150), nullable=True)
    won_amount: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CRMActivity(Base, TimestampMixin, TenantMixin):
    """
    Journal chronologique des actions sur un lead CRM.
    Chaque appel, email, WhatsApp, visite, note ou changement de statut est enregistré.
    Pas de SoftDelete — les activités sont immuables (traçabilité).
    RLS actif via company_id (TenantMixin).
    """

    __tablename__ = "crm_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Référence au lead
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crm_leads.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Utilisateur qui a effectué l'action
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Type d'activité
    type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Contenu libre (note, corps email, etc.)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Transition de statut (si type == "status_change")
    status_from: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status_to: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Planification / complétion
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
