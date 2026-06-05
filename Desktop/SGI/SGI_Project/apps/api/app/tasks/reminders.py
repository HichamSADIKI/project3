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
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.database import sync_session_maker
from app.models.golden_visa import GoldenVisaApplication
from app.models.notification import Notification
from app.models.pdc_cheque import PdcCheque
from app.models.rental import Rental
from app.routers.golden_visa.service import visa_alert_level
from app.routers.pdc.service import pdc_reminder_level
from app.tasks.celery_app import celery_app
from app.tasks.notifications import build_party_email_notification, deliver_email_notification

logger = logging.getLogger(__name__)

RENEWAL_HORIZON_DAYS = 120
PDC_DUE_SOON_DAYS = 7


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
    """Alertes Golden Visa à J-90 et J-30 avant expiration.

    Cron quotidien (toutes sociétés, rôle privilégié — voir C1). Pour chaque
    dossier dont le visa expire dans ≤ 90/≤ 30 jours et dont l'alerte du niveau
    n'a pas encore été émise : notification in-app au titulaire (client) +
    doublon e-mail s'il a une adresse. Idempotence via alert_90_sent /
    alert_30_sent (posés au passage).
    """
    today = datetime.now(UTC).date()
    horizon = today + timedelta(days=90)
    alerted = 0
    try:
        with sync_session_maker() as db:
            applications = (
                db.execute(
                    select(GoldenVisaApplication).where(
                        GoldenVisaApplication.deleted_at.is_(None),
                        GoldenVisaApplication.visa_expiry_date.isnot(None),
                        GoldenVisaApplication.visa_expiry_date <= horizon,
                        GoldenVisaApplication.visa_expiry_date >= today,
                    )
                )
                .scalars()
                .all()
            )

            pending_emails: list[tuple[Notification, str]] = []
            for app in applications:
                level = visa_alert_level(
                    today, app.visa_expiry_date, app.alert_90_sent, app.alert_30_sent
                )
                if level is None:
                    continue
                if level == "30":
                    app.alert_30_sent = True
                else:
                    app.alert_90_sent = True
                alerted += 1
                expiry_iso = app.visa_expiry_date.isoformat() if app.visa_expiry_date else ""
                title = "Golden Visa : expiration proche"
                body = f"Votre Golden Visa expire le {expiry_iso} (J-{level})."
                payload = {"golden_visa_id": str(app.id), "level": level}
                db.add(
                    Notification(
                        company_id=app.company_id,
                        recipient_party_id=app.client_id,
                        type="golden_visa_expiry",
                        channel="in_app",
                        title=title,
                        body=body,
                        payload=payload,
                        status="sent",
                        sent_at=datetime.now(UTC),
                    )
                )
                email_pair = build_party_email_notification(
                    db,
                    app.company_id,
                    app.client_id,
                    notif_type="golden_visa_expiry",
                    title=title,
                    body=body,
                    payload=payload,
                )
                if email_pair is not None:
                    pending_emails.append(email_pair)

            if alerted:
                db.commit()
                for notif, email in pending_emails:
                    deliver_email_notification(notif, to=email)
                logger.info("check_visa_expiry : %d alerte(s) Golden Visa émise(s)", alerted)
            return {"status": "ok", "alerts_sent": alerted}
    except Exception as exc:  # noqa: BLE001
        logger.error("check_visa_expiry failed: %s", exc)
        return {"status": "error", "alerts_sent": alerted}


@celery_app.task(name="app.tasks.reminders.check_rental_renewals", queue="reminders")
def check_rental_renewals() -> dict:
    """Alerte renouvellement de bail à J-120 avant échéance.

    Cron quotidien (toutes sociétés). Marque `renewal_alert_sent` pour les baux
    actifs arrivant à échéance dans <= 120 jours et pas encore alertés. Le worker
    tourne avec le rôle privilégié (scan multi-tenant volontaire — voir C1).
    """
    today = datetime.now(UTC).date()
    horizon = today + timedelta(days=RENEWAL_HORIZON_DAYS)
    alerted = 0
    try:
        with sync_session_maker() as db:
            rentals = (
                db.execute(
                    select(Rental).where(
                        Rental.deleted_at.is_(None),
                        Rental.status == "active",
                        Rental.renewal_alert_sent.is_(False),
                        Rental.end_date <= horizon,
                        Rental.end_date >= today,
                    )
                )
                .scalars()
                .all()
            )

            # Doublons e-mail à enfiler APRÈS commit (pas avant : on n'envoie
            # pas si la transaction est annulée).
            pending_emails: list[tuple[Notification, str]] = []
            for rental in rentals:
                rental.renewal_alert_sent = True
                alerted += 1
                title = "Renouvellement de bail à prévoir"
                body = (
                    "Votre bail arrive à échéance le "
                    f"{rental.end_date.isoformat()} (J-{RENEWAL_HORIZON_DAYS})."
                )
                # Notification in-app au locataire (le bail ne porte pas de FK
                # gestionnaire ; recipient_party_id = client_id). Idempotence via
                # renewal_alert_sent (posé ci-dessus).
                db.add(
                    Notification(
                        company_id=rental.company_id,
                        recipient_party_id=rental.client_id,
                        type="rental_renewal_due",
                        channel="in_app",
                        title=title,
                        body=body,
                        payload={"rental_id": str(rental.id)},
                        status="sent",
                        sent_at=datetime.now(UTC),
                    )
                )
                # Doublon e-mail si le locataire a une adresse (canal email, pending).
                email_pair = build_party_email_notification(
                    db,
                    rental.company_id,
                    rental.client_id,
                    notif_type="rental_renewal_due",
                    title=title,
                    body=body,
                    payload={"rental_id": str(rental.id)},
                )
                if email_pair is not None:
                    pending_emails.append(email_pair)

            if alerted:
                db.commit()
                # Enfile les envois après le commit (notifs email persistées).
                for notif, email in pending_emails:
                    deliver_email_notification(notif, to=email)
                logger.info("check_rental_renewals : %d bail(s) alerté(s) J-120", alerted)
            return {"status": "ok", "alerts_sent": alerted}
    except Exception as exc:  # noqa: BLE001
        logger.error("check_rental_renewals failed: %s", exc)
        return {"status": "error", "alerts_sent": alerted}


@celery_app.task(name="app.tasks.reminders.check_pdc_due", queue="reminders")
def check_pdc_due() -> dict:
    """Rappels chèques post-datés (M8) : échéance proche (J-7) ou retard de dépôt.

    Crée une notification in-app par PDC concerné, dédupliquée par (pdc_id, niveau)
    pour ne pas spammer à chaque exécution. Worker = rôle privilégié (scan
    multi-société volontaire, voir C1).
    """
    today = datetime.now(UTC).date()
    created = 0
    try:
        with sync_session_maker() as db:
            cheques = (
                db.execute(
                    select(PdcCheque).where(
                        PdcCheque.deleted_at.is_(None),
                        PdcCheque.status.in_(["pending", "deposited"]),
                    )
                )
                .scalars()
                .all()
            )

            # Anti-N+1 : précharge en une requête toutes les notifs PDC déjà
            # émises (type pdc_*), puis déduplique en mémoire sur (pdc_id, type)
            # au lieu d'un SELECT par chèque.
            existing_keys: set[tuple[str, str]] = {
                (str(pdc_id), notif_type)
                for pdc_id, notif_type in db.execute(
                    select(
                        Notification.payload["pdc_id"].astext,
                        Notification.type,
                    ).where(Notification.type.in_(["pdc_due_soon", "pdc_overdue"]))
                ).all()
            }

            # Doublons e-mail au tireur, enfilés APRÈS commit.
            pending_emails: list[tuple[Notification, str]] = []
            for pdc in cheques:
                level = pdc_reminder_level(today, pdc.due_date, pdc.status, PDC_DUE_SOON_DAYS)
                if level is None:
                    continue
                notif_type = f"pdc_{level}"
                # Dédup : une notif par (pdc, niveau) — lookup en mémoire.
                if (str(pdc.id), notif_type) in existing_keys:
                    continue
                title = (
                    f"Chèque {pdc.reference} en retard de dépôt"
                    if level == "overdue"
                    else f"Chèque {pdc.reference} à échéance proche"
                )
                body = f"Montant {pdc.amount_aed} AED, échéance {pdc.due_date.isoformat()}"
                payload = {"pdc_id": str(pdc.id), "level": level}
                db.add(
                    Notification(
                        company_id=pdc.company_id,
                        recipient_party_id=pdc.drawer_party_id,
                        type=notif_type,
                        channel="in_app",
                        title=title,
                        body=body,
                        payload=payload,
                        status="sent",
                        sent_at=datetime.now(UTC),
                    )
                )
                created += 1
                # Doublon e-mail si le tireur a une adresse (canal email, pending).
                email_pair = build_party_email_notification(
                    db,
                    pdc.company_id,
                    pdc.drawer_party_id,
                    notif_type=notif_type,
                    title=title,
                    body=body,
                    payload=payload,
                )
                if email_pair is not None:
                    pending_emails.append(email_pair)

            if created:
                db.commit()
                # Enfile les envois après le commit (notifs email persistées).
                for notif, email in pending_emails:
                    deliver_email_notification(notif, to=email)
                logger.info("check_pdc_due : %d notification(s) PDC créée(s)", created)
            return {"status": "ok", "alerts_sent": created}
    except Exception as exc:  # noqa: BLE001
        logger.error("check_pdc_due failed: %s", exc)
        return {"status": "error", "alerts_sent": created}
