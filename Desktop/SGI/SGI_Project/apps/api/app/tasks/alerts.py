"""Tâches Celery — Admin Console · évaluation préventive des règles d'alerte.

Queue : reminders
Beat :
- evaluate_alert_rules : toutes les 5 min — pour chaque règle active (toutes sociétés),
  calcule la métrique sur sa fenêtre depuis `audit_logs`, compare au seuil, et si
  dépassé crée un `admin_alert_event` (open) + notifie les admins/managers du tenant.

Scan **cross-tenant** légitime via le rôle privilégié (`sync_session_maker`, comme
`app.tasks.ticketing`/`maintenance`) : le cron balaie toutes les sociétés. La tâche ne
lève jamais au-delà du retry borné — elle ne doit jamais bloquer le beat.

Anti-spam : pas de nouvel événement tant qu'un événement `open`/`acked` existe déjà pour
la même règle (l'admin doit le résoudre avant qu'un nouveau soit créé).
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from celery import shared_task
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.database import sync_session_maker
from app.models.admin import AlertEvent, AlertRule
from app.models.audit_log import AuditLog
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.routers.admin.alerts import KNOWN_METRICS, evaluate_comparator

logger = logging.getLogger(__name__)

_NOTIFY_ROLES: tuple[str, ...] = (UserRole.MANAGER.value, UserRole.ADMIN.value)


def metric_select(
    metric: str, company_id: uuid.UUID, since: datetime
) -> "Select[tuple[int]] | None":
    """Construit le SELECT scalaire d'une métrique sur audit_logs (tenant + fenêtre).

    Helper PUR (ne touche pas la DB) → testable. Renvoie None si la métrique est
    inconnue (fail-safe : la règle est ignorée). Toutes les métriques filtrent
    explicitement par `company_id` (Loi 1 ; audit_logs n'a pas de RLS auto).
    """
    if metric not in KNOWN_METRICS:
        return None
    base_where = (AuditLog.company_id == company_id, AuditLog.created_at >= since)
    if metric == "audit_events":
        return select(func.count()).select_from(AuditLog).where(*base_where)
    if metric == "distinct_ips":
        return select(func.count(func.distinct(AuditLog.ip_address))).where(*base_where)
    if metric == "auth_events":
        return (
            select(func.count())
            .select_from(AuditLog)
            .where(*base_where, AuditLog.resource == "auth")
        )
    if metric == "delete_actions":
        return (
            select(func.count())
            .select_from(AuditLog)
            .where(*base_where, AuditLog.action.like("delete%"))
        )
    return None


def _has_active_event(db: Session, rule_id: uuid.UUID) -> bool:
    """Vrai si un événement open/acked existe déjà pour la règle (anti-doublon)."""
    row = db.execute(
        select(AlertEvent.id).where(
            AlertEvent.rule_id == rule_id,
            AlertEvent.status.in_(("open", "acked")),
            AlertEvent.deleted_at.is_(None),
        )
    ).first()
    return row is not None


def _notify_admins(db: Session, rule: AlertRule, value: float) -> None:
    """Crée une notification in-app pour les admins/managers actifs du tenant."""
    recipients = (
        db.execute(
            select(User.id).where(
                User.company_id == rule.company_id,
                User.role.in_(_NOTIFY_ROLES),
                User.deleted_at.is_(None),
                User.status == "active",
            )
        )
        .scalars()
        .all()
    )
    for uid in recipients:
        db.add(
            Notification(
                company_id=rule.company_id,
                recipient_user_id=uid,
                type="admin_alert",
                channel="in_app",
                title=f"Alerte « {rule.name} » ({rule.severity})",
                body=(
                    f"Métrique {rule.metric} = {value} "
                    f"{rule.comparator} seuil {rule.threshold} sur {rule.window_seconds}s."
                ),
                payload={
                    "rule_id": str(rule.id),
                    "metric": rule.metric,
                    "observed_value": str(value),
                    "severity": rule.severity,
                },
            )
        )


@shared_task(bind=True, max_retries=2)
def evaluate_alert_rules(self) -> dict[str, object]:  # noqa: ANN001  (signature Celery)
    """Évalue toutes les règles actives (cross-tenant) et déclenche les alertes."""
    fired = 0
    evaluated = 0
    try:
        with sync_session_maker() as db:
            now = datetime.now(UTC)
            rules = (
                db.execute(
                    select(AlertRule).where(
                        AlertRule.is_active.is_(True), AlertRule.deleted_at.is_(None)
                    )
                )
                .scalars()
                .all()
            )
            for rule in rules:
                evaluated += 1
                sel = metric_select(
                    rule.metric, rule.company_id, now - timedelta(seconds=rule.window_seconds)
                )
                if sel is None:
                    continue
                value = db.execute(sel).scalar() or 0
                if not evaluate_comparator(float(value), rule.comparator, float(rule.threshold)):
                    continue
                if _has_active_event(db, rule.id):
                    continue
                db.add(
                    AlertEvent(
                        company_id=rule.company_id,
                        rule_id=rule.id,
                        observed_value=Decimal(str(value)),
                        status="open",
                    )
                )
                _notify_admins(db, rule, float(value))
                fired += 1
            db.commit()
    except Exception as exc:  # noqa: BLE001  ne jamais bloquer le beat
        logger.exception("evaluate_alert_rules a échoué")
        raise self.retry(exc=exc, countdown=60) from exc
    return {"status": "ok", "evaluated": evaluated, "fired": fired}
