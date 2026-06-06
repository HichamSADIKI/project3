"""Tests — provider push FCM (pur, sans réseau)."""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.core import push
from app.core.config import settings


def test_build_message_minimal() -> None:
    msg = push.build_message(token="tok", title="Hi", body="There")
    assert msg["to"] == "tok"
    assert msg["notification"] == {"title": "Hi", "body": "There"}
    assert "data" not in msg


def test_build_message_with_data() -> None:
    msg = push.build_message(token="tok", title="t", body="b", data={"k": "v"})
    assert msg["data"] == {"k": "v"}


def test_console_backend_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "FCM_SERVER_KEY", "")
    out = push.send_to_token(token="tok", title="t", body="b")
    assert out == {"backend": "console", "token": "tok"}
    assert push.is_configured() is False


class _FakeResponse:
    def __init__(self, status_code: int = 200) -> None:
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=None)  # type: ignore[arg-type]


def test_fcm_backend_posts_with_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "FCM_SERVER_KEY", "srv-key")
    monkeypatch.setattr(settings, "FCM_ENDPOINT", "https://fcm.googleapis.com/fcm/send")
    captured: dict[str, Any] = {}

    def _fake_post(url: str, *, json: Any, headers: Any, timeout: Any) -> _FakeResponse:
        captured.update({"url": url, "json": json, "headers": headers})
        return _FakeResponse(200)

    monkeypatch.setattr(httpx, "post", _fake_post)
    out = push.send_to_token(token="device1", title="T", body="B", data={"x": "1"})
    assert out == {"backend": "fcm", "token": "device1"}
    assert captured["url"] == "https://fcm.googleapis.com/fcm/send"
    assert captured["headers"]["Authorization"] == "key=srv-key"
    assert captured["json"]["to"] == "device1"


def test_fcm_raises_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "FCM_SERVER_KEY", "k")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(500))
    with pytest.raises(httpx.HTTPStatusError):
        push.send_to_token(token="t", title="t", body="b")


# ── Push Expo (jetons app mobile) ────────────────────────────────────────────


def test_is_expo_token() -> None:
    assert push.is_expo_token("ExponentPushToken[abc]") is True
    assert push.is_expo_token("ExpoPushToken[xyz]") is True
    assert push.is_expo_token("fcm-device-token") is False


def test_build_expo_message() -> None:
    msg = push.build_expo_message(
        token="ExponentPushToken[a]", title="T", body="B", data={"k": "v"}
    )
    assert msg == {
        "to": "ExponentPushToken[a]",
        "title": "T",
        "body": "B",
        "sound": "default",
        "data": {"k": "v"},
    }


def test_expo_console_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "EXPO_PUSH_ENABLED", False)
    out = push.send_to_token(token="ExponentPushToken[a]", title="t", body="b")
    assert out == {"backend": "console", "token": "ExponentPushToken[a]"}


def test_expo_backend_posts_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "EXPO_PUSH_ENABLED", True)
    monkeypatch.setattr(settings, "EXPO_ACCESS_TOKEN", "acc-tok")
    monkeypatch.setattr(settings, "EXPO_PUSH_ENDPOINT", "https://exp.host/--/api/v2/push/send")
    captured: dict[str, Any] = {}

    def _fake_post(url: str, *, json: Any, headers: Any, timeout: Any) -> _FakeResponse:
        captured.update({"url": url, "json": json, "headers": headers})
        return _FakeResponse(200)

    monkeypatch.setattr(httpx, "post", _fake_post)
    out = push.send_to_token(token="ExponentPushToken[dev]", title="T", body="B", data={"x": "1"})
    assert out == {"backend": "expo", "token": "ExponentPushToken[dev]"}
    assert captured["url"] == "https://exp.host/--/api/v2/push/send"
    assert captured["headers"]["Authorization"] == "Bearer acc-tok"
    assert captured["json"] == {
        "to": "ExponentPushToken[dev]",
        "title": "T",
        "body": "B",
        "sound": "default",
        "data": {"x": "1"},
    }


def test_expo_raises_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "EXPO_PUSH_ENABLED", True)
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(500))
    with pytest.raises(httpx.HTTPStatusError):
        push.send_to_token(token="ExponentPushToken[a]", title="t", body="b")


def test_fcm_path_unaffected_by_expo(monkeypatch: pytest.MonkeyPatch) -> None:
    """Un jeton non-Expo continue de passer par FCM/console (pas de régression)."""
    monkeypatch.setattr(settings, "FCM_SERVER_KEY", "")
    out = push.send_to_token(token="plain-fcm-token", title="t", body="b")
    assert out == {"backend": "console", "token": "plain-fcm-token"}
