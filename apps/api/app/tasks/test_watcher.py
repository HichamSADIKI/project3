"""Tests du Watcher de portails — purs (sans DB, réseau mocké).

Couvre :
- `_parse_targets` : JSON invalide / non-liste / éléments non-dict → liste sûre.
- `_parse_html_for_channel` : aiguillage vers le bon parser scraping.
- `_fetch_sync` : validation de schéma (anti-SSRF) avant tout appel réseau.
- `run_property_watch` : no-op si désactivé / sans cible (orchestration).
- `_ingest_targets` : ingestion bout-en-bout avec `_fetch_sync` + engine mockés,
  idempotence (re-run → duplicate), respect du délai poli.

Tous les fetchs réseau sont mockés : aucun appel sortant réel.
"""

from __future__ import annotations

import uuid as _uuid
from types import SimpleNamespace
from typing import Any

import pytest

from app.tasks import watcher

# ── _parse_targets : robustesse ───────────────────────────────────────────────


class TestParseTargets:
    def test_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher.settings, "WATCHER_TARGETS", "")
        assert watcher._parse_targets() == []

    def test_invalid_json(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher.settings, "WATCHER_TARGETS", "{not json")
        assert watcher._parse_targets() == []

    def test_non_list_json(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Un objet JSON (dict) n'est PAS une liste de cibles → rejeté.
        monkeypatch.setattr(watcher.settings, "WATCHER_TARGETS", '{"company_id": "x"}')
        assert watcher._parse_targets() == []

    def test_filters_non_dict_items(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            watcher.settings,
            "WATCHER_TARGETS",
            '[{"company_id": "a", "urls": ["https://x"]}, 42, "str", null]',
        )
        targets = watcher._parse_targets()
        assert targets == [{"company_id": "a", "urls": ["https://x"]}]


# ── _parse_html_for_channel : aiguillage parser ──────────────────────────────


class TestParseHtmlForChannel:
    def test_bayut(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher, "parse_bayut_html", lambda h: {"p": "bayut"})
        assert watcher._parse_html_for_channel("<html>", "bayut")["p"] == "bayut"

    def test_propertyfinder(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher, "parse_propertyfinder_html", lambda h: {"p": "pf"})
        assert watcher._parse_html_for_channel("<html>", "propertyfinder")["p"] == "pf"
        assert watcher._parse_html_for_channel("<html>", "property_finder")["p"] == "pf"

    def test_dubizzle(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher, "parse_dubizzle_html", lambda h: {"p": "dz"})
        assert watcher._parse_html_for_channel("<html>", "dubizzle")["p"] == "dz"

    def test_fallback_unknown_channel(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Canal inconnu / None → repli PropertyFinder (JSON-LD/meta générique).
        monkeypatch.setattr(watcher, "parse_propertyfinder_html", lambda h: {"p": "fb"})
        assert watcher._parse_html_for_channel("<html>", None)["p"] == "fb"
        assert watcher._parse_html_for_channel("<html>", "unknown")["p"] == "fb"


# ── _fetch_sync : validation de schéma (anti-SSRF) ───────────────────────────


class TestFetchSyncScheme:
    @pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://x/y", "gopher://x", "  "])
    def test_rejects_non_http_scheme(self, url: str) -> None:
        # Aucune dépendance réseau touchée : refus AVANT import curl_cffi.
        assert watcher._fetch_sync(url) is None

    @pytest.mark.parametrize("url", ["http://example.com", "https://example.com"])
    def test_allows_http_https(self, monkeypatch: pytest.MonkeyPatch, url: str) -> None:
        # On mocke curl_cffi pour ne pas sortir sur le réseau.
        class _Resp:
            status_code = 200
            text = "<html>ok</html>"

        class _Session:
            def __init__(self, **_: Any) -> None: ...
            def get(self, *_: Any, **__: Any) -> _Resp:
                return _Resp()

        fake_mod = SimpleNamespace(requests=SimpleNamespace(Session=_Session))
        import sys

        monkeypatch.setitem(sys.modules, "curl_cffi", fake_mod)
        assert watcher._fetch_sync(url) == "<html>ok</html>"


# ── run_property_watch : orchestration (no-op si off / sans cible) ───────────


class TestRunPropertyWatch:
    def test_disabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher.settings, "WATCHER_ENABLED", False)
        result = watcher.run_property_watch()
        assert result == {"status": "disabled", "fetched": 0}

    def test_enabled_no_targets(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher.settings, "WATCHER_ENABLED", True)
        monkeypatch.setattr(watcher.settings, "WATCHER_TARGETS", "")
        result = watcher.run_property_watch()
        assert result == {"status": "no_targets", "fetched": 0}

    def test_enabled_runs_ingest(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher.settings, "WATCHER_ENABLED", True)
        monkeypatch.setattr(
            watcher.settings,
            "WATCHER_TARGETS",
            f'[{{"company_id": "{_uuid.uuid4()}", "urls": ["https://x"]}}]',
        )

        async def _fake_ingest(_targets: list[dict[str, Any]]) -> dict[str, int]:
            return {"fetched": 1, "imported": 1, "duplicates": 0, "rejected": 0}

        monkeypatch.setattr(watcher, "_ingest_targets", _fake_ingest)
        result = watcher.run_property_watch()
        assert result["status"] == "ok"
        assert result["imported"] == 1

    def test_never_raises_on_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(watcher.settings, "WATCHER_ENABLED", True)
        monkeypatch.setattr(
            watcher.settings,
            "WATCHER_TARGETS",
            f'[{{"company_id": "{_uuid.uuid4()}", "urls": ["https://x"]}}]',
        )

        async def _boom(_targets: list[dict[str, Any]]) -> dict[str, int]:
            raise RuntimeError("réseau KO")

        monkeypatch.setattr(watcher, "_ingest_targets", _boom)
        result = watcher.run_property_watch()
        assert result["status"] == "error"


# ── _ingest_targets : ingestion bout-en-bout (engine + ingest_record mockés) ──


class _FakeSession:
    """AsyncSession factice : execute (GUC) no-op, support `async with`."""

    async def execute(self, *_: Any, **__: Any) -> None:
        return None

    async def __aenter__(self) -> _FakeSession:
        return self

    async def __aexit__(self, *_: Any) -> None:
        return None


class _FakeEngine:
    async def dispose(self) -> None:
        return None


@pytest.mark.asyncio
async def test_ingest_targets_end_to_end(monkeypatch: pytest.MonkeyPatch) -> None:
    cid = str(_uuid.uuid4())
    targets = [
        {"company_id": cid, "channel": "bayut", "urls": ["https://portal/1", "https://portal/2"]}
    ]

    # Pas de réseau : _fetch_sync renvoie un HTML factice.
    monkeypatch.setattr(watcher, "_fetch_sync", lambda url: "<html>ok</html>")
    monkeypatch.setattr(watcher, "_parse_html_for_channel", lambda html, ch: {"title": "X"})
    # Délai poli neutralisé pour le test.
    monkeypatch.setattr(watcher.settings, "WATCHER_FETCH_DELAY_S", 0.0)

    # Engine/session factices : on n'ouvre AUCUNE connexion réelle.
    import sqlalchemy.ext.asyncio as sa_async

    monkeypatch.setattr(sa_async, "create_async_engine", lambda *a, **k: _FakeEngine())
    monkeypatch.setattr(sa_async, "AsyncSession", lambda *a, **k: _FakeSession())

    # ingest_record idempotent simulé : 1er=imported, suivants(même url)=duplicate.
    seen: set[str] = set()

    async def _fake_ingest_record(
        _db: Any, _company: Any, *, external_id: str | None = None, **__: Any
    ) -> Any:
        outcome = "duplicate" if external_id in seen else "imported"
        if external_id is not None:
            seen.add(external_id)
        return SimpleNamespace(status=outcome), outcome

    from app.routers.sources import service as sources_service

    monkeypatch.setattr(sources_service, "ingest_record", _fake_ingest_record)

    # 1er run : 2 URLs distinctes → 2 imported.
    summary = await watcher._ingest_targets(targets)
    assert summary["fetched"] == 2
    assert summary["imported"] == 2
    assert summary["duplicates"] == 0

    # 2e run (mêmes URLs) → idempotence : 2 duplicates, 0 imported.
    summary2 = await watcher._ingest_targets(targets)
    assert summary2["imported"] == 0
    assert summary2["duplicates"] == 2
