from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "sgi",
    broker=settings.VALKEY_URL,
    backend=settings.VALKEY_URL,
    include=[
        "app.tasks.notifications",
        "app.tasks.exports",
        "app.tasks.reminders",
        "app.tasks.maintenance",
        "app.tasks.comms",
        "app.tasks.workflows",
        "app.tasks.audit",
        "app.tasks.telephony",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Dubai",
    enable_utc=True,
    task_routes={
        "app.tasks.notifications.*": {"queue": "notifications"},
        "app.tasks.exports.*": {"queue": "exports"},
        "app.tasks.reminders.*": {"queue": "reminders"},
        # ── ERP (maintenance / comms / workflows) ────────────────────────
        # Routées vers les 3 queues existantes consommées par le worker
        # (-Q notifications,exports,reminders) — sinon tombent dans la queue
        # par défaut « celery » que le worker n'écoute pas → jamais exécutées.
        "app.tasks.maintenance.*": {"queue": "reminders"},
        "app.tasks.workflows.*": {"queue": "reminders"},
        "app.tasks.comms.notify_mentions": {"queue": "notifications"},
        "app.tasks.comms.transcribe_voice_note": {"queue": "exports"},
        "app.tasks.audit.*": {"queue": "reminders"},
        # ── Téléphonie ───────────────────────────────────────────────────
        "app.tasks.telephony.upload_call_recordings": {"queue": "exports"},
        "app.tasks.telephony.purge_expired_recordings": {"queue": "reminders"},
    },
    beat_schedule={
        "crm-followup-check": {
            "task": "app.tasks.reminders.check_crm_followups",
            "schedule": 3600.0,
        },
        "visa-expiry-alerts": {
            "task": "app.tasks.reminders.check_visa_expiry",
            "schedule": 86400.0,
        },
        "rental-renewal-alerts": {
            "task": "app.tasks.reminders.check_rental_renewals",
            "schedule": 86400.0,
        },
        "pdc-due-alerts": {
            "task": "app.tasks.reminders.check_pdc_due",
            "schedule": 86400.0,
        },
        # ── Maintenance (toutes les heures) ──────────────────────────────
        "maintenance-sla-check": {
            "task": "app.tasks.maintenance.check_maintenance_sla",
            "schedule": 3600.0,
        },
        "maintenance-preventive-gen": {
            "task": "app.tasks.maintenance.generate_preventive_tickets",
            "schedule": 3600.0,
        },
        # ── Workflow SLA (toutes les heures) ─────────────────────────────
        "workflow-sla-check": {
            "task": "app.tasks.workflows.check_workflow_sla",
            "schedule": 3600.0,
        },
        # ── Téléphonie ───────────────────────────────────────────────────
        # Upload des enregistrements toutes les 2 min ; purge PDPL quotidienne.
        "telephony-upload-recordings": {
            "task": "app.tasks.telephony.upload_call_recordings",
            "schedule": 120.0,
        },
        "telephony-purge-recordings": {
            "task": "app.tasks.telephony.purge_expired_recordings",
            "schedule": 86400.0,
        },
    },
)
