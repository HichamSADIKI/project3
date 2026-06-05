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
