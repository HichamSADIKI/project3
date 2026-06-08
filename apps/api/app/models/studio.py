"""Modèles SQLAlchemy — Studio de Modules (PLATEFORME, cross-tenant).

Périmètre B (infra-admin / plateforme, HORS Loi 1 — PAS de TenantMixin, PAS de
company_id ; exception documentée gardée par `require_platform_admin`, comme
`InfraService`/`InfraAction`). Le Studio permet à un super-admin plateforme de
concevoir de NOUVEAUX modules applicatifs depuis l'app.

Deux tables :
- `studio_modules` : 1 ligne/module conçu + sa machine à états du cycle de vie.
- `studio_integration_requests` : gouvernance d'intégration à **2 yeux (4-eyes)** —
  un admin demande, un admin DISTINCT approuve (contrainte `approved_by <> requested_by`
  imposée en base ET en service). TTL + audit + alerte. Remplace le mot de passe en dur.

Sécurité : l'intégration n'auto-merge JAMAIS — au mieux elle marque une PR prête ;
le merge final reste la gate humaine « GO #PR ».
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class StudioModule(Base, TimestampMixin, SoftDeleteMixin):
    """Module conçu via le Studio. Cross-tenant (plateforme) — pas de company_id."""

    __tablename__ = "studio_modules"
    __table_args__ = (
        UniqueConstraint("key", name="uq_studio_modules_key"),
        # Le `key` est stable et injecté dans des chemins/branches en Phase 3 :
        # on borne le charset au niveau base (défense en profondeur anti-injection).
        CheckConstraint("key ~ '^[a-z0-9_.]+$'", name="ck_studio_modules_key_charset"),
        CheckConstraint("flavor IN ('lite','code')", name="ck_studio_modules_flavor"),
        CheckConstraint("mode IN ('ai','manual')", name="ck_studio_modules_mode"),
        CheckConstraint(
            "state IN ('draft','built','tested','audited','pr_open',"
            "'approved','integrated','rejected','failed')",
            name="ck_studio_modules_state",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Clé métier stable (jamais dérivée d'une URL), ex. "studio.inventory".
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    title_ar: Mapped[str] = mapped_column(String(200), nullable=False)
    title_en: Mapped[str] = mapped_column(String(200), nullable=False)
    title_fr: Mapped[str] = mapped_column(String(200), nullable=False)
    # lite = schéma de feuille rendu par un moteur générique ; code = vrai code FastAPI+Next.
    flavor: Mapped[str] = mapped_column(String(10), nullable=False, default="lite")
    # ai = généré par l'IA (Gemini) ; manual = builder visuel.
    mode: Mapped[str] = mapped_column(String(10), nullable=False, default="manual")
    # Machine à états du cycle de vie (cf. _ALLOWED_TRANSITIONS dans le routeur).
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    # Schéma de feuille déclaratif (lite/manual) — données, JAMAIS exécuté.
    schema_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # Artefacts du pipeline (Phase 3) : branche/PR + rapports RADAR/CHASSEUR.
    branch_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    radar_report: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    chasseur_report: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # Intégré (nav dynamique active) ? Jamais un auto-merge — flag réversible côté plateforme.
    is_integrated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class StudioIntegrationRequest(Base):
    """Demande d'intégration à 2 yeux (4-eyes). Append-only. Pas de company_id.

    `approved_by` doit DIFFÉRER de `requested_by` (contrainte base + service) : un
    second humain distinct valide. `expires_at` borne la fenêtre (TTL) ; au-delà la
    demande est `expired` et inutilisable.
    """

    __tablename__ = "studio_integration_requests"
    __table_args__ = (
        # 4-eyes : l'approbateur ne peut pas être le demandeur (NULL tant que non approuvé).
        CheckConstraint(
            "approved_by IS NULL OR approved_by <> requested_by",
            name="ck_studio_intreq_four_eyes",
        ),
        CheckConstraint(
            "status IN ('pending','approved','rejected','expired')",
            name="ck_studio_intreq_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_modules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    ticket_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class StudioOrchestratorJob(Base, TimestampMixin):
    """Job de génération de code (Phase 3) — journal d'un run du worker `worker-studio`.

    Cross-tenant (plateforme) — pas de company_id. L'API n'insère qu'une ligne
    `status='requested'` puis enqueue `run_codegen_job(job_id)` ; **seul** le worker
    dédié (queue `studio`, profil compose éteint par défaut) la fait transiter
    `requested → running → done|failed`. `phase` suit l'étape courante du pipeline
    (scaffold/radar/chasseur/push/pr). Append-only, idempotent côté worker.
    """

    __tablename__ = "studio_orchestrator_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('requested','running','done','failed')",
            name="ck_studio_job_status",
        ),
        CheckConstraint(
            "phase IN ('queued','scaffold','radar','chasseur','push','pr','done','failed')",
            name="ck_studio_job_phase",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_modules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="codegen")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested")
    phase: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    detail: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    radar_report: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    chasseur_report: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    branch_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    worktree_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
