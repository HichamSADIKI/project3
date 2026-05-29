"""Tâches Celery — module Maintenance.

Queue : reminders
Beat :
- check_maintenance_sla        : toutes les heures — détecte les SLA dépassés
- generate_preventive_tickets  : toutes les heures — génère les tickets préventifs
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy import and_, select

from app.core.database import sync_session_maker  # session synchrone pour Celery
from app.models.maintenance import MaintenanceTicket
from app.models.maintenance_ext import MaintenancePlan
from app.routers.maintenance.service import (
    compute_sla_due,
    generate_reference,
    is_sla_breached,
)

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.maintenance.check_maintenance_sla", bind=True)
def check_maintenance_sla(self):
    """Parcourt les tickets actifs et alerte si le SLA est dépassé."""
    try:
        with sync_session_maker() as db:
            rows = db.execute(
                select(MaintenanceTicket).where(
                    MaintenanceTicket.deleted_at.is_(None),
                    MaintenanceTicket.sla_due_at.isnot(None),
                    MaintenanceTicket.status.notin_(["closed", "cancelled", "resolved"]),
                )
            ).scalars().all()

            breached = [t for t in rows if is_sla_breached(t)]
            if breached:
                logger.warning(
                    "SLA breached: %d tickets — refs: %s",
                    len(breached),
                    [t.reference for t in breached[:10]],
                )
                # TODO Phase 3 : envoyer une notification temps réel au manager.
            return {"checked": len(rows), "breached": len(breached)}
    except Exception as exc:
        logger.error("check_maintenance_sla failed: %s", exc)
        raise self.retry(exc=exc, countdown=300, max_retries=3)


@shared_task(name="app.tasks.maintenance.generate_preventive_tickets", bind=True)
def generate_preventive_tickets(self):
    """Génère les tickets de maintenance préventive dont la date est atteinte."""
    now = datetime.now(timezone.utc)
    generated = 0
    try:
        with sync_session_maker() as db:
            plans = db.execute(
                select(MaintenancePlan).where(
                    MaintenancePlan.deleted_at.is_(None),
                    MaintenancePlan.active.is_(True),
                    MaintenancePlan.next_due_at.isnot(None),
                    MaintenancePlan.next_due_at <= now,
                )
            ).scalars().all()

            for plan in plans:
                # Référence unique par tenant + année.
                year = now.year
                count = db.execute(
                    select(MaintenanceTicket.id)
                    .where(
                        MaintenanceTicket.company_id == plan.company_id,
                        MaintenanceTicket.deleted_at.is_(None),
                    )
                ).all()
                seq = len(count) + 1
                ref = generate_reference(year, seq)

                ticket = MaintenanceTicket(
                    company_id=plan.company_id,
                    reference=ref,
                    unit_id=plan.unit_id,
                    building_id=plan.building_id,
                    reported_by_user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
                    reporter_role="system",
                    category=plan.category,
                    priority=plan.priority,
                    status="new",
                    title=f"[Préventif] {plan.title}",
                    description=f"Généré automatiquement par le plan préventif (cron: {plan.cron_expression})",
                    sla_due_at=compute_sla_due(plan.priority, now),
                )
                db.add(ticket)

                # Mise à jour du plan : last_generated_at + next_due_at (+ 30j par défaut).
                # TODO : parser le cron_expression pour le calcul précis.
                plan.last_generated_at = now
                plan.next_due_at = now + timedelta(days=30)

                db.commit()
                generated += 1
                logger.info("Preventive ticket generated: %s (plan %s)", ref, plan.id)

        return {"generated": generated}
    except Exception as exc:
        logger.error("generate_preventive_tickets failed: %s", exc)
        raise self.retry(exc=exc, countdown=300, max_retries=3)
