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

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


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
    """Alerte renouvellement de bail à J-120 avant échéance."""
    logger.info("check_rental_renewals stub — à implémenter")
    return {"status": "noop", "alerts_sent": 0}
