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


# ─── build_party_email_notification (helper worker, session sync simulée) ────


class _FakeResult:
    def __init__(self, value: object) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object:
        return self._value


class _FakeSyncDB:
    """Double de la session sync du worker : execute() renvoie l'e-mail."""

    def __init__(self, email: object) -> None:
        self._email = email
        self.added: list[object] = []

    def execute(self, stmt: object) -> _FakeResult:
        return _FakeResult(self._email)

    def add(self, obj: object) -> None:
        self.added.append(obj)


def test_build_party_email_none_when_no_party() -> None:
    db = _FakeSyncDB("a@b.com")
    out = notif_tasks.build_party_email_notification(
        db, uuid.uuid4(), None, notif_type="x", title="t", body="b"
    )
    assert out is None
    assert db.added == []


def test_build_party_email_none_when_no_email() -> None:
    db = _FakeSyncDB(None)  # party sans adresse
    out = notif_tasks.build_party_email_notification(
        db, uuid.uuid4(), uuid.uuid4(), notif_type="x", title="t", body="b"
    )
    assert out is None
    assert db.added == []


def test_build_party_email_builds_pending_email_notification() -> None:
    db = _FakeSyncDB("tenant@example.com")
    company_id = uuid.uuid4()
    party_id = uuid.uuid4()
    out = notif_tasks.build_party_email_notification(
        db,
        company_id,
        party_id,
        notif_type="rental_renewal_due",
        title="Renouvellement",
        body="Votre bail expire bientôt.",
        payload={"rental_id": "r1"},
    )
    assert out is not None
    notif, email = out
    assert email == "tenant@example.com"
    assert notif.channel == "email"
    assert notif.status == "pending"
    assert notif.company_id == company_id
    assert notif.recipient_party_id == party_id
    assert notif.id is not None  # id généré côté Python (enfilable sans flush)
    assert db.added == [notif]


# ─── send_whatsapp_template (canal WhatsApp) ─────────────────────────────────


def test_whatsapp_task_console_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    out = notif_tasks.send_whatsapp_template.run(to="971500000000", template_name="t")
    assert out == {"status": "console", "to": "971500000000"}


def test_whatsapp_task_marks_notification_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "")  # backend console
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    executed: list[object] = []

    class _FakeDB:
        def execute(self, stmt: object) -> None:
            executed.append(stmt)

        def commit(self) -> None:
            pass

    @contextmanager
    def _fake_maker():
        yield _FakeDB()

    monkeypatch.setattr(notif_tasks, "sync_session_maker", _fake_maker)

    out = notif_tasks.send_whatsapp_template.run(
        to="971500000000",
        template_name="t",
        notification_id=str(uuid.uuid4()),
        company_id=str(uuid.uuid4()),
    )
    assert out["status"] == "console"
    assert len(executed) == 1  # UPDATE notifications ... status='sent'


def test_deliver_whatsapp_notification_enqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setattr(
        notif_tasks.send_whatsapp_template, "delay", lambda **kw: captured.update(kw)
    )
    notif = Notification(
        id=uuid.uuid4(),
        company_id=uuid.uuid4(),
        type="rental_renewal_due",
        channel="whatsapp",
        title="Renouvellement",
        body="…",
        status="pending",
    )
    notif_tasks.deliver_whatsapp_notification(
        notif, to="971500000000", template_name="renewal", language="ar"
    )
    assert captured["to"] == "971500000000"
    assert captured["template_name"] == "renewal"
    assert captured["language"] == "ar"
    assert captured["notification_id"] == str(notif.id)
    assert captured["company_id"] == str(notif.company_id)


# ─── send_push (canal push) ──────────────────────────────────────────────────


class _FakeScalars:
    def __init__(self, vals: list[object]) -> None:
        self._vals = vals

    def all(self) -> list[object]:
        return self._vals


class _FakePushResult:
    def __init__(self, vals: list[object]) -> None:
        self._vals = vals

    def scalars(self) -> _FakeScalars:
        return _FakeScalars(self._vals)


def _push_db_maker(tokens: list[str]):
    class _FakePushDB:
        def execute(self, stmt: object) -> _FakePushResult:
            return _FakePushResult(list(tokens))

        def commit(self) -> None:
            pass

    @contextmanager
    def _maker():
        yield _FakePushDB()

    return _maker


def test_push_task_no_device(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(notif_tasks, "sync_session_maker", _push_db_maker([]))
    out = notif_tasks.send_push.run(
        user_id=str(uuid.uuid4()), company_id=str(uuid.uuid4()), title="t", body="b"
    )
    assert out == {"status": "no_device", "sent": 0}


def test_push_task_console_backend_marks_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "FCM_SERVER_KEY", "")  # backend console
    monkeypatch.setattr(notif_tasks, "sync_session_maker", _push_db_maker(["tok1", "tok2"]))
    out = notif_tasks.send_push.run(
        user_id=str(uuid.uuid4()),
        company_id=str(uuid.uuid4()),
        title="t",
        body="b",
        notification_id=str(uuid.uuid4()),
    )
    assert out["status"] == "console"
    assert out["sent"] == 2


def test_deliver_push_notification_enqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setattr(notif_tasks.send_push, "delay", lambda **kw: captured.update(kw))
    notif = Notification(
        id=uuid.uuid4(),
        company_id=uuid.uuid4(),
        type="golden_visa_expiry",
        channel="push",
        title="Visa",
        body="Expire bientôt",
        status="pending",
    )
    user_id = uuid.uuid4()
    notif_tasks.deliver_push_notification(notif, user_id=user_id, data={"k": "v"})
    assert captured["user_id"] == str(user_id)
    assert captured["company_id"] == str(notif.company_id)
    assert captured["title"] == "Visa"
    assert captured["data"] == {"k": "v"}
    assert captured["notification_id"] == str(notif.id)


# ─── build_party_whatsapp_notification (miroir e-mail) ───────────────────────


def test_build_party_whatsapp_none_when_no_party() -> None:
    db = _FakeSyncDB("+971500000000")
    out = notif_tasks.build_party_whatsapp_notification(
        db, uuid.uuid4(), None, notif_type="x", title="t", body="b"
    )
    assert out is None
    assert db.added == []


def test_build_party_whatsapp_none_when_no_phone() -> None:
    db = _FakeSyncDB(None)  # party sans téléphone
    out = notif_tasks.build_party_whatsapp_notification(
        db, uuid.uuid4(), uuid.uuid4(), notif_type="x", title="t", body="b"
    )
    assert out is None
    assert db.added == []


def test_build_party_whatsapp_builds_pending_notification() -> None:
    db = _FakeSyncDB("+971500000000")
    company_id = uuid.uuid4()
    party_id = uuid.uuid4()
    out = notif_tasks.build_party_whatsapp_notification(
        db,
        company_id,
        party_id,
        notif_type="rental_renewal_due",
        title="Renouvellement",
        body="Votre bail expire bientôt.",
        payload={"rental_id": "r1"},
    )
    assert out is not None
    notif, phone = out
    assert phone == "+971500000000"
    assert notif.channel == "whatsapp"
    assert notif.status == "pending"
    assert notif.company_id == company_id
    assert notif.recipient_party_id == party_id
    assert notif.id is not None
    assert db.added == [notif]
