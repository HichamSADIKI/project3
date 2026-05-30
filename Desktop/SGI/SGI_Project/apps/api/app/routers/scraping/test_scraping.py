"""Tests Scraping — parsers HTML purs + build + garde anti-SSRF de la requête.

Aucun navigateur / réseau : on teste les fonctions d'extraction (parsers.py),
la construction du résultat (_build) et le validateur d'URL (allowlist + rejet
des IP privées). Le fetch Playwright/curl_cffi n'est pas couvert (I/O réseau).
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.routers.scraping.parsers import (
    _parse_generic_html,
    _safe_int,
    normalise_emirate,
    normalise_prop_type,
    parse_bayut_html,
    parse_dubizzle_html,
    parse_propertyfinder_html,
)
from app.routers.scraping.schemas import ScrapeRequest, ScrapedProperty
from app.routers.scraping.service import _build


# ── Helpers de normalisation ─────────────────────────────────────────────────


class TestNormalisers:
    @pytest.mark.parametrize("raw,expected", [
        ("flat", "apartment"), ("Studio", "apartment"), ("villa", "villa"),
        ("Townhouse", "townhouse"), ("penthouse", "penthouse"),
        ("shop", "retail"), ("warehouse", "office"), ("inconnu", "apartment"),
    ])
    def test_normalise_prop_type(self, raw: str, expected: str) -> None:
        assert normalise_prop_type(raw) == expected

    def test_normalise_emirate(self) -> None:
        assert normalise_emirate(["Dubai Marina"]) == "Dubai"
        assert normalise_emirate(["Abu Dhabi"]) == "Abu Dhabi"
        assert normalise_emirate(["Ajman"]) == "Other"
        assert normalise_emirate([]) == "Dubai"  # défaut

    def test_safe_int(self) -> None:
        assert _safe_int("3") == "3"
        assert _safe_int(4.0) == "4"
        assert _safe_int("1127.5") == "1127"
        assert _safe_int("") == ""
        assert _safe_int("abc") == ""
        assert _safe_int(None) == ""


# ── Bayut ────────────────────────────────────────────────────────────────────


BAYUT_HTML = """
<html><head>
<meta name="description" content="2-bed, 2-bath, 1,127 sqft apartment for sale at Marina Gate, Dubai Marina for AED 2,340,000">
<script type="application/ld+json">
{"@type":"RealEstateListing","name":"Spacious 2BR | Marina Gate | Bayut.com","description":"Belle vue mer, prox metro."}
</script>
</head><body>
<img src="https://images.bayut.com/thumbnails/123456-800x600.webp">
<img src="https://images.bayut.com/thumbnails/123456-400x300.webp">
<img src="https://images.bayut.com/thumbnails/789012-800x600.webp">
</body></html>
"""


class TestBayut:
    def test_extracts_specs_from_meta(self) -> None:
        r = parse_bayut_html(BAYUT_HTML)
        assert r["price"] == "2340000"
        assert r["sqft"] == "1127"
        assert r["bedrooms"] == "2"
        assert r["bathrooms"] == "2"
        assert r["type"] == "Sale"
        assert r["prop_type"] == "apartment"
        assert r["community"] == "Marina Gate"
        assert r["source"] == "Bayut.com"

    def test_title_and_description_from_jsonld(self) -> None:
        r = parse_bayut_html(BAYUT_HTML)
        assert r["title_en"] == "Spacious 2BR | Marina Gate"  # suffixe Bayut retiré
        assert "vue mer" in r["description"]

    def test_images_dedup_prefers_800x600(self) -> None:
        r = parse_bayut_html(BAYUT_HTML)
        # 2 IDs distincts ; on garde le 800x600 de chacun.
        assert r["images"] == [
            "https://images.bayut.com/thumbnails/123456-800x600.webp",
            "https://images.bayut.com/thumbnails/789012-800x600.webp",
        ]

    def test_empty_html_is_safe(self) -> None:
        r = parse_bayut_html("<html></html>")
        assert r["source"] == "Bayut.com"
        assert r["price"] == ""
        assert r["images"] == []


# ── PropertyFinder (__NEXT_DATA__) ───────────────────────────────────────────


PF_HTML = """
<html><body>
<script id="__NEXT_DATA__" type="application/json">
{"props":{"pageProps":{"propertyResult":{"property":{
  "title":"Luxury Villa Palm","description":"Villa signature.",
  "price":{"value":5000000},"bedrooms":4,"bathrooms":5,
  "size":{"value":3500,"unit":"sqft"},"category_id":1,"property_type":"villa",
  "location_tree":[{"name":"Dubai","type":"CITY"},{"name":"Palm Jumeirah","type":"COMMUNITY"}],
  "images":{"property":[{"full":"https://media.pf.ae/1.jpg"},{"full":"https://media.pf.ae/2.jpg"}]}
}}}}}
</script>
</body></html>
"""


class TestPropertyFinder:
    def test_extracts_from_next_data(self) -> None:
        r = parse_propertyfinder_html(PF_HTML)
        assert r["title_en"] == "Luxury Villa Palm"
        assert r["price"] == "5000000"
        assert r["bedrooms"] == "4"
        assert r["bathrooms"] == "5"
        assert r["sqft"] == "3500"
        assert r["type"] == "Sale"  # category_id 1
        assert r["prop_type"] == "villa"
        assert r["emirate"] == "Dubai"
        assert r["community"] == "Palm Jumeirah"
        assert r["images"] == ["https://media.pf.ae/1.jpg", "https://media.pf.ae/2.jpg"]
        assert r["source"] == "PropertyFinder.ae"

    def test_category_2_is_rent(self) -> None:
        html = PF_HTML.replace('"category_id":1', '"category_id":2')
        assert parse_propertyfinder_html(html)["type"] == "Rent"

    def test_meta_and_og_fallback_when_no_next_data(self) -> None:
        html = """<html><head>
        <meta name="description" content="Charming 1-bed, 650 sqft for AED 95,000">
        <meta property="og:title" content="Cozy 1BR Studio">
        <meta property="og:image" content="https://media.pf.ae/og.jpg">
        </head></html>"""
        r = parse_propertyfinder_html(html)
        assert r["title_en"] == "Cozy 1BR Studio"
        assert r["price"] == "95000"
        assert r["sqft"] == "650"
        assert r["images"] == ["https://media.pf.ae/og.jpg"]


# ── Générique / Dubizzle ─────────────────────────────────────────────────────


GENERIC_HTML = """
<html><head>
<script type="application/ld+json">
{"@type":"Product","name":"Cozy Studio Downtown","description":"Studio meublé.",
 "offers":{"price":"850000"},"image":["https://cdn/a.jpg","https://cdn/b.jpg"]}
</script>
</head></html>
"""


class TestGenericAndDubizzle:
    def test_generic_jsonld_product(self) -> None:
        r = _parse_generic_html(GENERIC_HTML, "Dubizzle.com")
        assert r["title_en"] == "Cozy Studio Downtown"
        assert r["price"] == "850000"
        assert r["images"] == ["https://cdn/a.jpg", "https://cdn/b.jpg"]
        assert r["source"] == "Dubizzle.com"

    def test_dubizzle_delegates_to_generic(self) -> None:
        r = parse_dubizzle_html(GENERIC_HTML)
        assert r["source"] == "Dubizzle.com"
        assert r["title_en"] == "Cozy Studio Downtown"

    def test_price_fallback_from_page_text(self) -> None:
        html = "<html><body>Prix demandé : AED 1,250,000 négociable</body></html>"
        r = _parse_generic_html(html, "Other")
        assert r["price"] == "1250000"


# ── _build (service) ─────────────────────────────────────────────────────────


class TestBuild:
    def test_counts_fields_found(self) -> None:
        res = _build({
            "title_en": "T", "price": "100", "bedrooms": "2",
            "images": ["https://x/1.jpg"], "source": "Bayut.com",
        })
        assert isinstance(res, ScrapedProperty)
        # title_en + price + bedrooms (3 champs comptés) + images (1) = 4
        assert res.fields_found == 4

    def test_truncates_title_and_limits_images(self) -> None:
        res = _build({
            "title_en": "X" * 300,
            "images": [f"https://x/{i}.jpg" for i in range(12)] + ["", None],
        })
        assert len(res.title_en) == 200
        assert len(res.images) == 8  # plafonné à 8
        assert all(res.images)  # vides/None filtrés

    def test_defaults_when_empty(self) -> None:
        res = _build({})
        assert res.type == "Sale"
        assert res.prop_type == "apartment"
        assert res.fields_found == 0


# ── Garde anti-SSRF du validateur d'URL ──────────────────────────────────────


class TestScrapeRequestValidation:
    @pytest.mark.parametrize("url", [
        "https://www.bayut.com/property/details-123.html",
        "https://propertyfinder.ae/en/plp/buy/abc",
        "https://uae.dubizzle.com/property/xyz",
    ])
    def test_allowed_hosts(self, url: str) -> None:
        assert str(ScrapeRequest(url=url).url).startswith("http")

    @pytest.mark.parametrize("url", [
        "https://evil.example.com/x",       # hôte hors allowlist
        "http://127.0.0.1/admin",            # loopback
        "http://169.254.169.254/latest/meta",  # link-local (métadonnées cloud)
        "http://192.168.1.10/internal",      # IP privée
    ])
    def test_rejected_urls(self, url: str) -> None:
        with pytest.raises(ValidationError):
            ScrapeRequest(url=url)
