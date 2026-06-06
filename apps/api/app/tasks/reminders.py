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
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.database import sync_session_maker
from app.models.client import Client
from app.models.crm import CRMLead
from app.models.dunning import DunningEvent
from app.models.finance import FinanceTransaction
from app.models.golden_visa import GoldenVisaApplication
from app.models.notification import Notification
from app.models.pdc_cheque import PdcCheque
from app.models.rental import Rental
from app.routers.crm.service import (
    FOLLOWUP_ACTIVE_STATUSES,
    followup_next_schedule,
    next_followup_action,
)
from app.routers.finance.dunning import days_overdue, dunning_level, should_escalate
from app.routers.golden_visa.service import visa_alert_level
from app.routers.pdc.service import pdc_reminder_level
from app.tasks.celery_app import celery_app
from app.tasks.notifications import (
    build_party_email_notification,
    build_party_whatsapp_notification,
    deliver_email_notification,
    deliver_push_notification,
    deliver_whatsapp_notification,
)

logger = logging.getLogger(__name__)

RENEWAL_HORIZON_DAYS = 120
PDC_DUE_SOON_DAYS = 7


_CRM_FOLLOWUP_TEMPLATE = "crm_followup"


def _crm_followup_message(action: str, lead: CRMLead) -> tuple[str, str]:
    """Titre + corps FR de la relance selon l'étape."""
    ref = lead.reference or str(lead.id)[:8]
    labels = {
        "call": ("Relance prospect : appel à passer (J+1)", f"Appeler le prospect {ref}."),
        "whatsapp": (
            "Relance prospect : WhatsApp (J+2)",
            f"Message WhatsApp de relance envoyé au prospect {ref}.",
        ),
        "email": (
            "Relance prospect : e-mail (J+4)",
            f"E-mail de relance envoyé au prospect {ref}.",
        ),
        "push_whatsapp": (
            "Relance prospect : dernier recours (J+7)",
            f"Dernière relance (push + WhatsApp) pour le prospect {ref}.",
        ),
    }
    return labels[action]


@celery_app.task(name="app.tasks.reminders.check_crm_followups", queue="reminders")
def check_crm_followups() -> dict:
    """Séquence de relance CRM automatique (max 4 tentatives sur 7 jours).

    Cron horaire (toutes sociétés, rôle privilégié — voir C1). Pour chaque lead
    encore actif (statut new/contacted) dont la prochaine tentative est due :
    J+1 appel (tâche in-app à l'agent), J+2 WhatsApp (client), J+4 e-mail (client),
    J+7 push (agent) + WhatsApp (client). Après la 4ᵉ tentative sans réponse :
    statut ``lost`` / ``lost_reason='non_respondent'``. Les envois externes
    (e-mail/WhatsApp/push) sont enfilés APRÈS commit.
    """
    now = datetime.now(UTC)
    processed = 0
    closed = 0
    try:
        with sync_session_maker() as db:
            leads = (
                db.execute(
                    select(CRMLead).where(
                        CRMLead.deleted_at.is_(None),
                        CRMLead.status.in_(tuple(FOLLOWUP_ACTIVE_STATUSES)),
                    )
                )
                .scalars()
                .all()
            )
            # Précharge les clients (anti-N+1) pour résoudre e-mail/téléphone.
            client_ids = {lead.client_id for lead in leads}
            clients: dict[uuid.UUID, Client] = {}
            if client_ids:
                rows = db.execute(select(Client).where(Client.id.in_(client_ids))).scalars().all()
                clients = {c.id: c for c in rows}

            pending_emails: list[tuple[Notification, str]] = []
            pending_whatsapp: list[tuple[Notification, str]] = []
            pending_push: list[tuple[Notification, uuid.UUID]] = []

            for lead in leads:
                action = next_followup_action(now, lead.created_at, lead.contact_attempts)
                if action is None:
                    continue
                if action == "lost":
                    lead.status = "lost"
                    lead.lost_reason = "non_respondent"
                    lead.next_action_at = None
                    lead.next_action_type = None
                    closed += 1
                    continue

                title, body = _crm_followup_message(action, lead)
                payload = {"lead_id": str(lead.id), "step": action}
                client = clients.get(lead.client_id)

                # J+1 appel → tâche in-app à l'agent.
                if action == "call" and lead.agent_id is not None:
                    db.add(
                        Notification(
                            company_id=lead.company_id,
                            recipient_user_id=lead.agent_id,
                            type="crm_followup",
                            channel="in_app",
                            title=title,
                            body=body,
                            payload=payload,
                            status="sent",
                            sent_at=now,
                        )
                    )

                # J+4 e-mail → client (si adresse).
                if action == "email":
                    email_pair = build_party_email_notification(
                        db,
                        lead.company_id,
                        lead.client_id,
                        notif_type="crm_followup",
                        title=title,
                        body=body,
                        payload=payload,
                    )
                    if email_pair is not None:
                        pending_emails.append(email_pair)

                # J+2 et J+7 → WhatsApp au client (si téléphone).
                if action in ("whatsapp", "push_whatsapp") and client is not None and client.phone:
                    wa_notif = Notification(
                        id=uuid.uuid4(),
                        company_id=lead.company_id,
                        recipient_party_id=lead.client_id,
                        type="crm_followup",
                        channel="whatsapp",
                        title=title,
                        body=body,
                        payload=payload,
                        status="pending",
                    )
                    db.add(wa_notif)
                    pending_whatsapp.append((wa_notif, client.phone))

                # J+7 → push à l'agent (escalade).
                if action == "push_whatsapp" and lead.agent_id is not None:
                    push_notif = Notification(
                        id=uuid.uuid4(),
                        company_id=lead.company_id,
                        recipient_user_id=lead.agent_id,
                        type="crm_followup",
                        channel="push",
                        title=title,
                        body=body,
                        payload=payload,
                        status="pending",
                    )
                    db.add(push_notif)
                    pending_push.append((push_notif, lead.agent_id))

                # Avance le compteur + planifie la prochaine étape.
                lead.contact_attempts += 1
                lead.last_contact_at = now
                lead.next_action_at, lead.next_action_type = followup_next_schedule(
                    lead.created_at, lead.contact_attempts
                )
                processed += 1

            if processed or closed:
                db.commit()
                # Enfile les envois externes après le commit (rien si rollback).
                for notif, email in pending_emails:
                    deliver_email_notification(notif, to=email)
                for notif, phone in pending_whatsapp:
                    deliver_whatsapp_notification(
                        notif, to=phone, template_name=_CRM_FOLLOWUP_TEMPLATE
                    )
                for notif, agent_id in pending_push:
                    deliver_push_notification(notif, user_id=agent_id)
                logger.info(
                    "check_crm_followups : %d relance(s), %d clôturé(s) non_respondent",
                    processed,
                    closed,
                )
            return {"status": "ok", "processed": processed, "closed": closed}
    except Exception as exc:  # noqa: BLE001
        logger.error("check_crm_followups failed: %s", exc)
        return {"status": "error", "processed": processed, "closed": closed}


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
            pending_whatsapp: list[tuple[Notification, str]] = []
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
                wa_pair = build_party_whatsapp_notification(
                    db,
                    app.company_id,
                    app.client_id,
                    notif_type="golden_visa_expiry",
                    title=title,
                    body=body,
                    payload=payload,
                )
                if wa_pair is not None:
                    pending_whatsapp.append(wa_pair)

            if alerted:
                db.commit()
                for notif, email in pending_emails:
                    deliver_email_notification(notif, to=email)
                for notif, phone in pending_whatsapp:
                    deliver_whatsapp_notification(
                        notif, to=phone, template_name="golden_visa_expiry"
                    )
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

            # Doublons e-mail/WhatsApp à enfiler APRÈS commit (pas avant : on
            # n'envoie pas si la transaction est annulée).
            pending_emails: list[tuple[Notification, str]] = []
            pending_whatsapp: list[tuple[Notification, str]] = []
            for rental in rentals:
                rental.renewal_alert_sent = True
                alerted += 1
                title = "Renouvellement de bail à prévoir"
                body = (
                    "Votre bail arrive à échéance le "
                    f"{rental.end_date.isoformat()} (J-{RENEWAL_HORIZON_DAYS})."
                )
                payload = {"rental_id": str(rental.id)}
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
                        payload=payload,
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
                    payload=payload,
                )
                if email_pair is not None:
                    pending_emails.append(email_pair)
                # Doublon WhatsApp si le locataire a un téléphone.
                wa_pair = build_party_whatsapp_notification(
                    db,
                    rental.company_id,
                    rental.client_id,
                    notif_type="rental_renewal_due",
                    title=title,
                    body=body,
                    payload=payload,
                )
                if wa_pair is not None:
                    pending_whatsapp.append(wa_pair)

            if alerted:
                db.commit()
                # Enfile les envois après le commit (notifs persistées).
                for notif, email in pending_emails:
                    deliver_email_notification(notif, to=email)
                for notif, phone in pending_whatsapp:
                    deliver_whatsapp_notification(
                        notif, to=phone, template_name="rental_renewal_due"
                    )
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

            # Doublons e-mail/WhatsApp au tireur, enfilés APRÈS commit.
            pending_emails: list[tuple[Notification, str]] = []
            pending_whatsapp: list[tuple[Notification, str]] = []
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
                # Doublon WhatsApp si le tireur a un téléphone.
                wa_pair = build_party_whatsapp_notification(
                    db,
                    pdc.company_id,
                    pdc.drawer_party_id,
                    notif_type=notif_type,
                    title=title,
                    body=body,
                    payload=payload,
                )
                if wa_pair is not None:
                    pending_whatsapp.append(wa_pair)

            if created:
                db.commit()
                # Enfile les envois après le commit (notifs persistées).
                for notif, email in pending_emails:
                    deliver_email_notification(notif, to=email)
                for notif, phone in pending_whatsapp:
                    deliver_whatsapp_notification(notif, to=phone, template_name=notif.type)
                logger.info("check_pdc_due : %d notification(s) PDC créée(s)", created)
            return {"status": "ok", "alerts_sent": created}
    except Exception as exc:  # noqa: BLE001
        logger.error("check_pdc_due failed: %s", exc)
        return {"status": "error", "alerts_sent": created}


@celery_app.task(name="app.tasks.reminders.check_overdue_invoices", queue="reminders")
def check_overdue_invoices() -> dict:
    """Relances automatiques des factures impayées (échéancier & relances).

    Cron quotidien (toutes sociétés). Pour chaque facture (`type='invoice'`)
    en retard, calcule le niveau d'escalade (J+1/J+7/J+15) et envoie une relance
    au client SI le niveau a monté depuis la dernière relance journalisée
    (`DunningEvent`). Réutilise l'infra de notification (in-app + e-mail/WhatsApp).
    Worker = rôle privilégié (scan multi-société volontaire, voir C1).
    """
    today = datetime.now(UTC).date()
    sent = 0
    try:
        with sync_session_maker() as db:
            invoices = (
                db.execute(
                    select(FinanceTransaction).where(
                        FinanceTransaction.deleted_at.is_(None),
                        FinanceTransaction.type == "invoice",
                        FinanceTransaction.status.in_(["pending", "overdue"]),
                        FinanceTransaction.due_date.isnot(None),
                    )
                )
                .scalars()
                .all()
            )

            # Anti-N+1 : dernier niveau de relance déjà envoyé par transaction.
            last_levels: dict[uuid.UUID, int] = {
                tid: (lvl or 0)
                for tid, lvl in db.execute(
                    select(
                        DunningEvent.transaction_id,
                        func.max(DunningEvent.level),
                    ).group_by(DunningEvent.transaction_id)
                ).all()
            }

            pending_emails: list[tuple[Notification, str]] = []
            pending_whatsapp: list[tuple[Notification, str]] = []
            for inv in invoices:
                days = days_overdue(inv.due_date, today)
                level = dunning_level(days)
                # Passe le statut à overdue dès qu'une échéance est dépassée.
                if days > 0 and inv.status == "pending":
                    inv.status = "overdue"
                if not should_escalate(level, last_levels.get(inv.id, 0)):
                    continue
                sent += 1
                title = f"Relance facture {inv.reference}"
                body = (
                    f"Facture {inv.reference} ({inv.amount} {inv.currency}) impayée — "
                    f"retard de {days} jour(s)."
                )
                payload = {"transaction_id": str(inv.id), "level": level}
                db.add(
                    Notification(
                        company_id=inv.company_id,
                        recipient_party_id=inv.related_client_id,
                        type="invoice_overdue",
                        channel="in_app",
                        title=title,
                        body=body,
                        payload=payload,
                        status="sent",
                        sent_at=datetime.now(UTC),
                    )
                )
                db.add(
                    DunningEvent(
                        company_id=inv.company_id,
                        transaction_id=inv.id,
                        channel="in_app",
                        level=level,
                        message=body,
                    )
                )
                if inv.related_client_id is not None:
                    email_pair = build_party_email_notification(
                        db,
                        inv.company_id,
                        inv.related_client_id,
                        notif_type="invoice_overdue",
                        title=title,
                        body=body,
                        payload=payload,
                    )
                    if email_pair is not None:
                        pending_emails.append(email_pair)
                    wa_pair = build_party_whatsapp_notification(
                        db,
                        inv.company_id,
                        inv.related_client_id,
                        notif_type="invoice_overdue",
                        title=title,
                        body=body,
                        payload=payload,
                    )
                    if wa_pair is not None:
                        pending_whatsapp.append(wa_pair)

            if sent or invoices:
                db.commit()
                for notif, email in pending_emails:
                    deliver_email_notification(notif, to=email)
                for notif, phone in pending_whatsapp:
                    deliver_whatsapp_notification(notif, to=phone, template_name="invoice_overdue")
                if sent:
                    logger.info("check_overdue_invoices : %d relance(s) envoyée(s)", sent)
            return {"status": "ok", "alerts_sent": sent}
    except Exception as exc:  # noqa: BLE001
        logger.error("check_overdue_invoices failed: %s", exc)
        return {"status": "error", "alerts_sent": sent}
