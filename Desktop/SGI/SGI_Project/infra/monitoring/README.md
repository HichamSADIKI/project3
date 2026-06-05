# Observabilité SGI — Prometheus + Grafana

Stack **opt-in** (n'est pas démarrée par `make up`) qui scrape les métriques de
l'API (`GET /metrics`, exposées par `prometheus-fastapi-instrumentator`) et de
l'hôte/conteneurs, avec des dashboards et alertes prêts à l'emploi.

## Démarrer / arrêter

```bash
make monitoring        # démarre prometheus + grafana + node-exporter + cadvisor
make monitoring-down   # arrête et supprime ces conteneurs
```

Équivaut à :

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.monitoring.yml up -d prometheus grafana node-exporter cadvisor
```

## Accès

| Service | URL | Identifiants |
|---|---|---|
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3002 | `admin` / `admin` (override via `GRAFANA_USER` / `GRAFANA_PASSWORD`) |

Grafana est **provisionné** automatiquement : datasource Prometheus + dashboard
**« SGI · API »** (dossier *SGI*) — disponibilité, débit, latence p50/p95/p99,
erreurs 5xx, mémoire, top handlers.

## Cibles scrapées (`infra/monitoring/prometheus/prometheus.yml`)

- `sgi-api` → `api:8000/metrics` (métriques applicatives FastAPI)
- `node-exporter` → métriques hôte (CPU/mémoire/disque) — Linux prod
- `cadvisor` → métriques par conteneur

> Sur **Docker Desktop macOS**, `node-exporter` et `cadvisor` mesurent la VM Linux
> sous-jacente (pas macOS) et peuvent être bruyants — c'est normal ; en prod Linux
> ils donnent les vraies métriques hôte/conteneurs. Le cœur (API + Grafana) marche partout.

## Alertes (`infra/monitoring/prometheus/alerts.yml`)

`ApiDown` (up==0, 1 min) · `HighHttp5xxRate` (>0,5 req/s 5xx, 5 min) ·
`HighRequestLatencyP95` (p95 > 1 s, 5 min) · `ApiHighMemory` (>1,5 Go, 10 min).

Pour router les alertes (e-mail/Slack/WhatsApp), ajouter un **Alertmanager** —
non inclus ici (les règles sont évaluées par Prometheus, visibles dans l'onglet *Alerts*).

## Prod

- Ne pas exposer 9090/3002 publiquement : passer par Nginx + auth, ou réseau privé.
- Définir `GRAFANA_PASSWORD` (et idéalement un secret) dans l'environnement.
- Ajuster `--storage.tsdb.retention.time` selon la rétention voulue.
