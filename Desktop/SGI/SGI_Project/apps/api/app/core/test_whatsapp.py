"""Tests — sender WhatsApp (pur, sans réseau).

Couvre le builder de payload template et les deux backends (console / Cloud API).
L'appel HTTP réel est remplacé par un double de ``httpx.post``.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.core import whatsapp
from app.core.config import settings


def test_build_template_payload_minimal() -> None:
    payload = whatsapp.build_template_payload(to="971500000000", template_name="renewal")
    assert payload["messaging_product"] == "whatsapp"
    assert payload["to"] == "971500000000"
    assert payload["type"] == "template"
    assert payload["template"]["name"] == "renewal"
    assert payload["template"]["language"]["code"] == settings.WHATSAPP_DEFAULT_LANG
    assert "components" not in payload["template"]


def test_build_template_payload_with_language_and_components() -> None:
    comps: list[dict[str, Any]] = [{"type": "body", "parameters": [{"type": "text", "text": "x"}]}]
    payload = whatsapp.build_template_payload(
        to="971500000000", template_name="t", language="en_US", components=comps
    )
    assert payload["template"]["language"]["code"] == "en_US"
    assert payload["template"]["components"] == comps


def test_console_backend_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    out = whatsapp.send_template(to="971500000000", template_name="t")
    assert out == {"backend": "console", "to": "971500000000"}
    assert whatsapp.is_configured() is False


class _FakeResponse:
    def __init__(self, status_code: int = 200) -> None:
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=None)  # type: ignore[arg-type]


def test_cloud_api_backend_posts_with_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "tok123")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "55501")
    monkeypatch.setattr(settings, "WHATSAPP_API_VERSION", "v18.0")
    monkeypatch.setattr(settings, "WHATSAPP_BASE_URL", "https://graph.facebook.com")
    captured: dict[str, Any] = {}

    def _fake_post(url: str, *, json: Any, headers: Any, timeout: Any) -> _FakeResponse:
        captured.update({"url": url, "json": json, "headers": headers})
        return _FakeResponse(200)

    monkeypatch.setattr(httpx, "post", _fake_post)

    out = whatsapp.send_template(to="971500000000", template_name="renewal")
    assert out == {"backend": "cloud_api", "to": "971500000000"}
    assert captured["url"] == "https://graph.facebook.com/v18.0/55501/messages"
    assert captured["headers"]["Authorization"] == "Bearer tok123"
    assert captured["json"]["template"]["name"] == "renewal"


def test_cloud_api_raises_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "tok")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "1")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(400))
    with pytest.raises(httpx.HTTPStatusError):
        whatsapp.send_template(to="x", template_name="t")
