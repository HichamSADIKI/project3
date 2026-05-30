"""Property scraping service.

Strategy (fastest to slowest):
  1. curl_cffi  — TLS fingerprint impersonation (Chrome124), no browser overhead.
     Works for: Bayut.com (validated). Falls back to step 2 if blocked.
  2. Playwright — Full headless Chromium for JS-rendered pages or strong bot protection.
     Both layers use the same HTML parsers in parsers.py.

Browser lifecycle:
  Playwright browser is a shared singleton started at app startup.
  Each request gets an isolated BrowserContext + Page.
"""
from __future__ import annotations

import logging
import random
from urllib.parse import urlparse

from app.routers.scraping.parsers import (
    _parse_generic_html,
    parse_bayut_html,
    parse_dubizzle_html,
    parse_propertyfinder_html,
)
from app.routers.scraping.schemas import ScrapedProperty

logger = logging.getLogger(__name__)

# ── curl_cffi session (module-level, reuses TCP connections) ──────────────────

try:
    from curl_cffi import requests as _cffi_requests  # type: ignore[import]
    _CFFI_SESSION = _cffi_requests.Session(impersonate="chrome124")
    _CFFI_AVAILABLE = True
except ImportError:
    _CFFI_AVAILABLE = False
    _CFFI_SESSION = None  # type: ignore[assignment]

# ── Playwright browser singleton ──────────────────────────────────────────────

try:
    from playwright.async_api import (  # type: ignore[import]
        Browser,
        BrowserContext,
        Playwright,
        async_playwright,
    )
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False

_playwright_instance: Playwright | None = None
_browser: Browser | None = None


async def start_browser() -> None:
    """Call from FastAPI lifespan startup."""
    global _playwright_instance, _browser
    if not _PLAYWRIGHT_AVAILABLE:
        logger.warning("Playwright not installed — browser fallback disabled")
        return
    pw = await async_playwright().start()  # type: ignore[union-attr]
    _playwright_instance = pw
    _browser = await pw.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox", "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars", "--disable-dev-shm-usage",
        ],
    )
    logger.info("Playwright Chromium started")


async def stop_browser() -> None:
    """Call from FastAPI lifespan shutdown."""
    global _playwright_instance, _browser
    if _browser:
        await _browser.close()  # type: ignore[union-attr]
        _browser = None
    if _playwright_instance:
        await _playwright_instance.stop()  # type: ignore[union-attr]
        _playwright_instance = None


# ── Public entry point ────────────────────────────────────────────────────────

async def scrape_property_page(url: str) -> ScrapedProperty:
    hostname = urlparse(url).netloc.lower()

    # Try fast HTTP path first
    if _CFFI_AVAILABLE:
        try:
            html = await _fetch_cffi(url)
            raw = _parse_html(html, hostname)
            if raw.get("title_en"):
                return _build(raw)
        except Exception as exc:
            logger.warning("curl_cffi failed for %s: %s", url, exc)

    # Playwright fallback
    if _PLAYWRIGHT_AVAILABLE and _browser:
        try:
            html = await _fetch_playwright(url)
            raw = _parse_html(html, hostname)
            return _build(raw)
        except Exception as exc:
            logger.error("Playwright also failed for %s: %s", url, exc)

    raise RuntimeError(f"Could not fetch property page: {url}")


# ── HTTP layer — curl_cffi ────────────────────────────────────────────────────

async def _fetch_cffi(url: str) -> str:
    import asyncio

    def _sync_get() -> str:
        resp = _CFFI_SESSION.get(  # type: ignore[union-attr]
            url,
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": f"https://{urlparse(url).netloc}/",
            },
            timeout=20,
        )
        if resp.status_code not in (200, 301, 302):
            raise ValueError(f"HTTP {resp.status_code}")
        if "captcha" in resp.text[:500].lower() and len(resp.text) < 20_000:
            raise ValueError("Captcha page returned")
        return resp.text

    # Polite delay (jitter anti-bot, non cryptographique)
    await asyncio.sleep(random.uniform(0.3, 1.0))  # noqa: S311
    return await asyncio.get_event_loop().run_in_executor(None, _sync_get)


# ── HTTP layer — Playwright ───────────────────────────────────────────────────

async def _fetch_playwright(url: str) -> str:
    ctx: BrowserContext = await _browser.new_context(  # type: ignore[union-attr]
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 800},
        locale="en-US",
        timezone_id="Asia/Dubai",
    )
    try:
        page = await ctx.new_page()
        await page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        await page.wait_for_timeout(int(random.uniform(300, 800)))  # noqa: S311
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        await page.wait_for_timeout(2_000)
        return await page.content()
    finally:
        await ctx.close()


# ── Routing to site parsers ───────────────────────────────────────────────────

def _parse_html(html: str, hostname: str) -> dict:  # type: ignore[type-arg]
    if "bayut" in hostname:
        return parse_bayut_html(html)
    if "propertyfinder" in hostname:
        return parse_propertyfinder_html(html)
    if "dubizzle" in hostname:
        return parse_dubizzle_html(html)
    source = hostname.replace("www.", "")
    return _parse_generic_html(html, source)


# ── Build result ──────────────────────────────────────────────────────────────

_COUNTED = ["title_en", "price", "bedrooms", "bathrooms", "sqft",
            "emirate", "community", "description"]


def _build(raw: dict) -> ScrapedProperty:  # type: ignore[type-arg]
    result = ScrapedProperty(
        title_en=    raw.get("title_en", "")[:200],
        price=       raw.get("price", ""),
        type=        raw.get("type", "Sale"),  # type: ignore[arg-type]
        prop_type=   raw.get("prop_type", "apartment"),
        bedrooms=    raw.get("bedrooms", ""),
        bathrooms=   raw.get("bathrooms", ""),
        sqft=        raw.get("sqft", ""),
        emirate=     raw.get("emirate", ""),
        community=   raw.get("community", ""),
        description= raw.get("description", "")[:2000],
        images=      [u for u in raw.get("images", []) if u][:8],
        source=      raw.get("source", ""),
    )
    result.fields_found = (
        sum(1 for f in _COUNTED if getattr(result, f))
        + (1 if result.images else 0)
    )
    return result
