"""Reminder tasks — schedulés par Celery Beat.

Trois tâches référencées par celery_app.beat_schedule :
- check_crm_followups : toutes les heures, lance la séquence CRM J+1/J+2/J+4/J+7
- check_visa_expiry   : tous les jours, alertes Golden Visa J-90 / J-30
- check_rental_renewals : tous les jours, alerte renouvellement bail J-120

Stubs minimaux : aucune logique métier ici. À implémenter en branchant
les services CRM / Golden Visa / Rentals existants.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import sync_session_maker
from app.models.rental import Rental
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

RENEWAL_HORIZON_DAYS = 120


@celery_app.task(name="app.tasks.reminders.check_crm_followups", queue="reminders")
def check_crm_followups() -> dict:
    """Lance la séquence de relance CRM (4 tentatives sur 7 jours).

    Sélectionne les prospects 'new' sans réponse récente, pousse les
    tâches d'appel/WhatsApp/email selon le calendrier J+1/J+2/J+4/J+7.
    """
    logger.info("check_crm_followups stub — à implémenter")
    return {"status": "noop", "processed": 0}


@celery_app.task(name="app.tasks.reminders.check_visa_expiry", queue="reminders")
def check_visa_expiry() -> dict:
    """Alertes Golden Visa à J-90 et J-30 avant expiration."""
    logger.info("check_visa_expiry stub — à implémenter")
    return {"status": "noop", "alerts_sent": 0}


@celery_app.task(name="app.tasks.reminders.check_rental_renewals", queue="reminders")
def check_rental_renewals() -> dict:
    """Alerte renouvellement de bail à J-120 avant échéance.

    Cron quotidien (toutes sociétés). Marque `renewal_alert_sent` pour les baux
    actifs arrivant à échéance dans <= 120 jours et pas encore alertés. Le worker
    tourne avec le rôle privilégié (scan multi-tenant volontaire — voir C1).
    """
    today = datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=RENEWAL_HORIZON_DAYS)
    alerted = 0
    try:
        with sync_session_maker() as db:
            rentals = db.execute(
                select(Rental).where(
                    Rental.deleted_at.is_(None),
                    Rental.status == "active",
                    Rental.renewal_alert_sent.is_(False),
                    Rental.end_date <= horizon,
                    Rental.end_date >= today,
                )
            ).scalars().all()

            for rental in rentals:
                rental.renewal_alert_sent = True
                alerted += 1
                # TODO : pousser la notification (email/WhatsApp/push) au gestionnaire.

            if alerted:
                db.commit()
                logger.info("check_rental_renewals : %d bail(s) alerté(s) J-120", alerted)
            return {"status": "ok", "alerts_sent": alerted}
    except Exception as exc:  # noqa: BLE001
        logger.error("check_rental_renewals failed: %s", exc)
        return {"status": "error", "alerts_sent": alerted}
