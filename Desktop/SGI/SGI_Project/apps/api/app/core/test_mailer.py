"""Tests — mailer transactionnel (pur, sans réseau).

Couvre le builder MIME et les deux backends (console / SMTP). Le SMTP réel est
remplacé par un faux serveur (monkeypatch de ``smtplib.SMTP``) : on vérifie le
STARTTLS, le login conditionnel et l'envoi, sans ouvrir de socket.
"""

from __future__ import annotations

import smtplib

import pytest

from app.core import mailer
from app.core.config import settings


def test_build_message_text_only() -> None:
    msg = mailer.build_message(
        to="lead@example.com",
        subject="Bienvenue",
        text_body="Bonjour",
        from_addr="no-reply@sgi.ae",
        from_name="SGI",
    )
    assert msg["To"] == "lead@example.com"
    assert msg["Subject"] == "Bienvenue"
    assert "SGI" in msg["From"] and "no-reply@sgi.ae" in msg["From"]
    assert msg.get_content_type() == "text/plain"


def test_build_message_with_html_is_multipart_alternative() -> None:
    msg = mailer.build_message(
        to="lead@example.com",
        subject="HTML",
        text_body="texte de repli",
        html_body="<b>riche</b>",
    )
    assert msg.is_multipart()
    subtypes = {part.get_content_type() for part in msg.iter_parts()}
    assert "text/plain" in subtypes
    assert "text/html" in subtypes


def test_console_backend_when_smtp_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    out = mailer.send_email(to="a@b.com", subject="x", text_body="y")
    assert out == {"backend": "console", "to": "a@b.com"}
    assert mailer.is_configured() is False


class _FakeSMTP:
    """Double de ``smtplib.SMTP`` : enregistre les appels, n'ouvre rien."""

    instances: list[_FakeSMTP] = []

    def __init__(self, host: str, port: int, timeout: int = 0) -> None:
        self.host = host
        self.port = port
        self.started_tls = False
        self.logged_in: tuple[str, str] | None = None
        self.sent: list[object] = []
        _FakeSMTP.instances.append(self)

    def __enter__(self) -> _FakeSMTP:
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def ehlo(self) -> None:
        pass

    def starttls(self) -> None:
        self.started_tls = True

    def login(self, user: str, password: str) -> None:
        self.logged_in = (user, password)

    def send_message(self, msg: object) -> None:
        self.sent.append(msg)


def test_smtp_backend_starttls_and_login(monkeypatch: pytest.MonkeyPatch) -> None:
    _FakeSMTP.instances.clear()
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_STARTTLS", True)
    monkeypatch.setattr(settings, "SMTP_USERNAME", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "secret")
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    out = mailer.send_email(to="dest@x.com", subject="Sujet", text_body="corps")

    assert out == {"backend": "smtp", "to": "dest@x.com"}
    assert len(_FakeSMTP.instances) == 1
    inst = _FakeSMTP.instances[0]
    assert inst.host == "smtp.example.com" and inst.port == 587
    assert inst.started_tls is True
    assert inst.logged_in == ("user", "secret")
    assert len(inst.sent) == 1


def test_smtp_backend_no_login_without_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    _FakeSMTP.instances.clear()
    monkeypatch.setattr(settings, "SMTP_HOST", "relay.local")
    monkeypatch.setattr(settings, "SMTP_STARTTLS", False)
    monkeypatch.setattr(settings, "SMTP_USERNAME", "")
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    mailer.send_email(to="dest@x.com", subject="s", text_body="b")

    inst = _FakeSMTP.instances[0]
    assert inst.started_tls is False  # STARTTLS désactivé
    assert inst.logged_in is None  # pas de login sans username
