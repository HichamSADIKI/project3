"""Tests — utilitaire de géocodage (Loi 2). Logique pure + fail-secure."""

import pytest

from app.core import geocoding
from app.core.geocoding import build_query, geocode, parse_geocode_response


class TestParseGeocodeResponse:
    def test_extracts_first_result_coords(self) -> None:
        data = {
            "status": "OK",
            "results": [
                {"geometry": {"location": {"lat": 25.0772, "lng": 55.1409}}},
                {"geometry": {"location": {"lat": 0, "lng": 0}}},
            ],
        }
        assert parse_geocode_response(data) == (25.0772, 55.1409)

    def test_zero_results(self) -> None:
        assert parse_geocode_response({"status": "ZERO_RESULTS", "results": []}) is None

    def test_non_ok_status(self) -> None:
        assert parse_geocode_response({"status": "REQUEST_DENIED", "results": []}) is None

    def test_missing_location(self) -> None:
        assert parse_geocode_response({"status": "OK", "results": [{"geometry": {}}]}) is None

    def test_non_numeric_coords(self) -> None:
        data = {"status": "OK", "results": [{"geometry": {"location": {"lat": "x", "lng": 5}}}]}
        assert parse_geocode_response(data) is None

    def test_bool_coords_rejected(self) -> None:
        # bool est sous-type d'int en Python — ne doit pas passer pour une coordonnée.
        data = {"status": "OK", "results": [{"geometry": {"location": {"lat": True, "lng": 1}}}]}
        assert parse_geocode_response(data) is None

    def test_empty_dict(self) -> None:
        assert parse_geocode_response({}) is None


class TestBuildQuery:
    def test_joins_non_empty_and_appends_uae(self) -> None:
        assert build_query("Marina Tower", "Dubai Marina", "Dubai") == (
            "Marina Tower, Dubai Marina, Dubai, UAE"
        )

    def test_skips_empty_fragments(self) -> None:
        assert build_query(None, "  ", "Marina", "Dubai") == "Marina, Dubai, UAE"

    def test_does_not_double_uae(self) -> None:
        assert build_query("Marina", "UAE") == "Marina, UAE"

    def test_all_empty_returns_empty(self) -> None:
        assert build_query(None, "", "   ") == ""


class TestGeocodeFailSecure:
    @pytest.mark.asyncio
    async def test_no_api_key_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Clé vide (déterministe) → aucun appel réseau, fallback None.
        monkeypatch.setattr(geocoding.settings, "GOOGLE_MAPS_API_KEY", "")
        assert await geocode("Dubai Marina, UAE") is None

    @pytest.mark.asyncio
    async def test_empty_query_returns_none(self) -> None:
        assert await geocode("   ") is None

    @pytest.mark.asyncio
    async def test_with_key_parses_mocked_response(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Avec une clé, géocode via httpx (mocké) et renvoie les coords parsées."""
        monkeypatch.setattr(geocoding.settings, "GOOGLE_MAPS_API_KEY", "fake-key")

        class _Resp:
            def raise_for_status(self) -> None:
                pass

            def json(self) -> dict:
                return {
                    "status": "OK",
                    "results": [{"geometry": {"location": {"lat": 25.1, "lng": 55.2}}}],
                }

        class _Client:
            def __init__(self, *a: object, **k: object) -> None:
                pass

            async def __aenter__(self) -> "_Client":
                return self

            async def __aexit__(self, *a: object) -> None:
                return None

            async def get(self, *a: object, **k: object) -> _Resp:
                return _Resp()

        monkeypatch.setattr(geocoding.httpx, "AsyncClient", _Client)
        assert await geocode("Dubai Marina, UAE") == (25.1, 55.2)
