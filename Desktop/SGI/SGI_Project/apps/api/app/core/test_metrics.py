"""Test — endpoint d'observabilité `/metrics` (Prometheus).

Vérifie que l'instrumentation expose `/metrics` au format Prometheus, sans
authentification (le scrape Prometheus n'envoie pas de JWT).
"""

from httpx import AsyncClient


async def test_metrics_endpoint_is_public_and_prometheus_format(client: AsyncClient) -> None:
    # Aucun en-tête Authorization → le scrape doit fonctionner sans JWT.
    resp = await client.get("/metrics")
    assert resp.status_code == 200, resp.text
    body = resp.text
    # Format d'exposition Prometheus (familles de métriques déclarées).
    assert "# HELP" in body
    assert "# TYPE" in body


async def test_metrics_counts_requests(client: AsyncClient) -> None:
    # Une requête applicative apparaît dans les compteurs HTTP instrumentés.
    await client.get("/health")
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    # Le nom exact dépend de la version ; on vérifie la famille de requêtes HTTP.
    assert "http_request" in resp.text
