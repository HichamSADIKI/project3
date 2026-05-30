"""Tâches Celery — Workflow Engine.

Queue : reminders
Beat  : check_workflow_sla — toutes les heures.
"""
import logging
import uuid
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select

from app.core.database import sync_session_maker
from app.models.notification import Notification
from app.models.workflow import WorkflowEvent, WorkflowInstance, WorkflowStep
from app.routers.workflows.service import is_step_sla_breached

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.workflows.check_workflow_sla", bind=True)
def check_workflow_sla(self) -> dict:
    """Détecte les steps en retard et déclenche l'escalade automatique."""
    escalated = 0
    try:
        with sync_session_maker() as db:
            # Steps actifs avec SLA dépassé.
            steps = db.execute(
                select(WorkflowStep).where(
                    WorkflowStep.status == "in_progress",
                    WorkflowStep.sla_due_at.isnot(None),
                )
            ).scalars().all()

            breached = [s for s in steps if is_step_sla_breached(s)]
            now = datetime.now(timezone.utc)

            for step in breached:
                # Escalade : passage au statut escalated.
                step.status = "escalated"
                step.completed_at = now

                # Journal.
                db.add(WorkflowEvent(
                    company_id=step.company_id,
                    instance_id=step.instance_id,
                    step_id=step.id,
                    actor_user_id=None,  # action système
                    event_type="escalate",
                    comment="SLA dépassé — escalade automatique Celery beat",
                    created_at=now,
                ))

                # Notification in-app (M6) au responsable de l'étape.
                db.add(Notification(
                    company_id=step.company_id,
                    recipient_user_id=step.actor_user_id,
                    type="workflow_escalation",
                    channel="in_app",
                    title=f"Étape de validation escaladée — {step.name}",
                    body="SLA dépassé : l'étape a été escaladée automatiquement.",
                    payload={"instance_id": str(step.instance_id), "step_id": str(step.id)},
                    status="sent",
                    sent_at=now,
                ))

                # Passe le step suivant en in_progress.
                next_steps = db.execute(
                    select(WorkflowStep).where(
                        WorkflowStep.instance_id == step.instance_id,
                        WorkflowStep.step_order > step.step_order,
                        WorkflowStep.status == "pending",
                    ).order_by(WorkflowStep.step_order)
                ).scalars().first()

                if next_steps:
                    next_steps.status = "in_progress"
                else:
                    # Aucun step suivant → instance escalated/en attente.
                    instance = db.execute(
                        select(WorkflowInstance).where(
                            WorkflowInstance.id == step.instance_id
                        )
                    ).scalar_one_or_none()
                    if instance and instance.status == "in_progress":
                        logger.warning(
                            "Workflow instance %s : tous les steps escaladés, "
                            "intervention manager requise.", instance.id
                        )

                db.commit()
                escalated += 1
                logger.info("Step %s escalated (SLA breach)", step.id)

        return {"checked": len(steps), "escalated": escalated}
    except Exception as exc:
        logger.error("check_workflow_sla failed: %s", exc)
        raise self.retry(exc=exc, countdown=300, max_retries=3)
