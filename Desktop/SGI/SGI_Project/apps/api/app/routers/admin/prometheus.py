"""Client minimal pour l'API HTTP de Prometheus (lecture des métriques infra).

On ne stocke AUCUNE métrique en base : la collecte est déjà faite par la stack
Prometheus/Grafana/Loki (cf. `infra/`). Ce module se contente d'interroger
l'endpoint `/api/v1/query` (valeur instantanée) en lecture seule.

Dégradation : si `PROMETHEUS_URL` est absent ou l'endpoint injoignable, on lève
`PrometheusUnavailableError` ; le routeur infra le traduit en réponse « métriques
indisponibles » (pas un 500), pour que la console reste utilisable hors prod.
"""

from __future__ import annotations

import os
from typing import Any

import httpx


class PrometheusUnavailableError(RuntimeError):
    """Prometheus non configuré ou injoignable (dégradation attendue)."""


def prometheus_url() -> str | None:
    """URL de base Prometheus (ex. http://prometheus:9090), ou None si non configuré."""
    url = os.getenv("PROMETHEUS_URL", "").strip()
    return url or None


async def instant_query(expr: str, *, timeout: float = 3.0) -> float | None:
    """Exécute une requête instantanée PromQL et renvoie la 1ʳᵉ valeur scalaire.

    Renvoie None si la requête ne retourne aucune série. Lève `PrometheusUnavailableError`
    si Prometheus n'est pas configuré ou répond mal — à rattraper côté routeur.
    """
    base = prometheus_url()
    if not base:
        raise PrometheusUnavailableError("prometheus_not_configured")
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.get(f"{base}/api/v1/query", params={"query": expr})
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError) as exc:  # réseau, timeout, JSON invalide
        raise PrometheusUnavailableError(str(exc)) from exc

    if payload.get("status") != "success":
        raise PrometheusUnavailableError(payload.get("error", "prometheus_query_failed"))
    results = payload.get("data", {}).get("result", [])
    if not results:
        return None
    # Format vecteur instantané : result[0]["value"] == [timestamp, "valeur"].
    try:
        return float(results[0]["value"][1])
    except (KeyError, IndexError, ValueError):
        return None


async def active_alerts(*, timeout: float = 3.0) -> list[dict[str, Any]]:
    """Liste les alertes actives de Prometheus (endpoint `/api/v1/alerts`).

    Retourne la liste brute `data.alerts` (chaque élément : `labels`, `state`,
    `activeAt`, `annotations`, …) telle que définie par `prometheus/alerts.yml`.
    Lève `PrometheusUnavailableError` si Prometheus n'est pas configuré ou répond
    mal — à rattraper côté routeur (dégradation propre, jamais de 500).
    """
    base = prometheus_url()
    if not base:
        raise PrometheusUnavailableError("prometheus_not_configured")
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.get(f"{base}/api/v1/alerts")
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise PrometheusUnavailableError(str(exc)) from exc

    if payload.get("status") != "success":
        raise PrometheusUnavailableError(payload.get("error", "prometheus_alerts_failed"))
    alerts = payload.get("data", {}).get("alerts", [])
    return alerts if isinstance(alerts, list) else []


async def range_query(
    expr: str, *, start: float, end: float, step: float = 300.0, timeout: float = 5.0
) -> list[tuple[float, float]]:
    """Série temporelle d'une métrique (`/api/v1/query_range`) → liste (ts, valeur).

    Pour la prédiction de tendance (B3). Renvoie [] si aucune série. Lève
    `PrometheusUnavailableError` si Prometheus injoignable — à rattraper côté routeur.
    """
    base = prometheus_url()
    if not base:
        raise PrometheusUnavailableError("prometheus_not_configured")
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.get(
                f"{base}/api/v1/query_range",
                params={"query": expr, "start": start, "end": end, "step": step},
            )
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise PrometheusUnavailableError(str(exc)) from exc

    if payload.get("status") != "success":
        raise PrometheusUnavailableError(payload.get("error", "prometheus_range_failed"))
    result = payload.get("data", {}).get("result", [])
    if not result:
        return []
    points: list[tuple[float, float]] = []
    for pair in result[0].get("values", []):
        try:
            points.append((float(pair[0]), float(pair[1])))
        except (ValueError, TypeError, IndexError):
            continue
    return points
