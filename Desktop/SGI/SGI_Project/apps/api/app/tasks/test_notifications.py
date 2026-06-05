"""Tests — tâche Celery d'envoi d'e-mail (host-runnable, sans DB ni broker).

On évite la vraie connexion Postgres : ``sync_session_maker`` et
``send_email.delay`` sont remplacés par des doubles. Le mailer est forcé en
backend console (``SMTP_HOST`` vide) — aucun socket ouvert.
"""

from __future__ import annotations

import uuid
from contextlib import contextmanager

import pytest

from app.core.config import settings
from app.models.notification import Notification
from app.tasks import notifications as notif_tasks


def test_task_console_backend_without_notification(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    out = notif_tasks.send_email.run(to="x@y.com", subject="Sujet", body="Corps")
    assert out == {"status": "console", "to": "x@y.com"}


def test_task_marks_notification_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SMTP_HOST", "")  # backend console
    executed: list[object] = []
    committed: list[bool] = []

    class _FakeDB:
        def execute(self, stmt: object) -> None:
            executed.append(stmt)

        def commit(self) -> None:
            committed.append(True)

    @contextmanager
    def _fake_maker():
        yield _FakeDB()

    monkeypatch.setattr(notif_tasks, "sync_session_maker", _fake_maker)

    out = notif_tasks.send_email.run(
        to="dest@x.com",
        subject="s",
        body="b",
        notification_id=str(uuid.uuid4()),
        company_id=str(uuid.uuid4()),
    )
    assert out["status"] == "console"
    assert len(executed) == 1  # UPDATE notifications ... status='sent'
    assert committed == [True]


def test_deliver_email_notification_enqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def _fake_delay(**kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(notif_tasks.send_email, "delay", _fake_delay)

    notif = Notification(
        id=uuid.uuid4(),
        company_id=uuid.uuid4(),
        type="statement_ready",
        channel="email",
        title="Votre relevé est prêt",
        body="Bonjour, votre relevé mensuel est disponible.",
        status="pending",
    )

    notif_tasks.deliver_email_notification(notif, to="owner@x.com")

    assert captured["to"] == "owner@x.com"
    assert captured["subject"] == "Votre relevé est prêt"
    assert captured["body"] == "Bonjour, votre relevé mensuel est disponible."
    assert captured["notification_id"] == str(notif.id)
    assert captured["company_id"] == str(notif.company_id)


def test_deliver_email_falls_back_to_title_when_no_body(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setattr(notif_tasks.send_email, "delay", lambda **kw: captured.update(kw))

    notif = Notification(
        id=uuid.uuid4(),
        company_id=uuid.uuid4(),
        type="other",
        channel="email",
        title="Titre seul",
        body=None,
        status="pending",
    )
    notif_tasks.deliver_email_notification(notif, to="a@b.com")
    assert captured["body"] == "Titre seul"  # repli sur le titre
