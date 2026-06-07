"""Tests purs de la tâche d'évaluation des alertes (`app.tasks.alerts`).

Sans DB ni Celery : on valide le helper `metric_select` (construction de requête par
métrique, filtrage tenant + fenêtre, fail-safe sur métrique inconnue). L'orchestration
`evaluate_alert_rules` est du glue testé indirectement via les tests d'API + le
comparateur pur (`test_admin_alerts.py`).
"""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import Select

from app.routers.admin.alerts import KNOWN_METRICS
from app.tasks.alerts import metric_select

_CID = uuid.uuid4()
_SINCE = datetime(2026, 1, 1, tzinfo=UTC)


def test_metric_select_unknown_is_none() -> None:
    assert metric_select("nope", _CID, _SINCE) is None


@pytest.mark.parametrize("metric", KNOWN_METRICS)
def test_metric_select_known_returns_scoped_query(metric: str) -> None:
    sel = metric_select(metric, _CID, _SINCE)
    assert isinstance(sel, Select)
    sql = str(sel.compile(compile_kwargs={"literal_binds": False})).lower()
    # Toujours scopé tenant + fenêtre + agrégat count sur audit_logs (Loi 1).
    assert "audit_logs" in sql
    assert "count" in sql
    assert "company_id" in sql
    assert "created_at" in sql


def test_metric_select_distinct_ips_uses_distinct() -> None:
    sql = str(metric_select("distinct_ips", _CID, _SINCE).compile()).lower()
    assert "distinct" in sql
    assert "ip_address" in sql


def test_metric_select_auth_and_delete_filters() -> None:
    auth_sql = str(metric_select("auth_events", _CID, _SINCE).compile()).lower()
    assert "resource" in auth_sql
    delete_sql = str(metric_select("delete_actions", _CID, _SINCE).compile()).lower()
    assert "action" in delete_sql and "like" in delete_sql
