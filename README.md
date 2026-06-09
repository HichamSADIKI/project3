# SGI — Système de Gestion Immobilière

SaaS **multi-tenant** de gestion immobilière de bout en bout pour **Infinity International Facilities
Management UAE** — marché Émirats Arabes Unis (Dubaï, Abu Dhabi), à vocation internationale.

**Domaine** : catalogue de biens · ventes · locations · CRM · contrats · **Golden Visa UAE**.
**Langues** : Arabe RTL (primaire) · Anglais · Français — trilingue de bout en bout.
**Devise** : AED (dirham), chiffres latins, stockée en `DECIMAL(15,2)`.
**Conformité by-design** : PDPL (UAE Data Office) · KYC/AML/goAML · TDRA · RERA/Ejari/DLD/DEWA/ADDC.

Plateforme **web** (back-office + portail public), **mobile** (Expo) et **API**, pensée
Arabe-RTL-first et secure-by-default.

## Les 3 Lois architecturales — tout PR qui les viole est bloqué

1. **Multi-tenant** — `company_id UUID NOT NULL` + index + **RLS PostgreSQL** sur chaque table métier.
   `TenantMiddleware` décode le JWT et exécute `SET LOCAL app.current_company_id` à chaque requête.
   Jamais de requête sans filtre `company_id`. En prod, définir `APP_DB_PASSWORD` (rôle restreint
   `sgi_app`) sinon la RLS est inerte — voir [DEPLOYMENT.md](DEPLOYMENT.md).
2. **PostGIS** — le géospatial vit dans la base : `location GEOMETRY(Point, 4326)`, index GIST,
   distances en `::geography` (mètres).
3. **RTL arabe** — CSS logique uniquement (`ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`), jamais
   physique (`ml-*`/`pr-*`/`left-*`…).

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js 15.3 (App Router · Turbopack) · React 19 · TypeScript 5 strict |
| UI / i18n | shadcn/ui (RTL) · Radix · Tailwind v4 · i18next (AR/EN/FR · Noto Sans Arabic) |
| State | TanStack Query v5 · Zustand v4 · Zod v3 |
| Mobile | Expo 51 · React Native 0.74 · Expo Router · NativeWind |
| Backend | FastAPI 0.136 · Python 3.13 · Pydantic v2 · SQLAlchemy 2 async · GeoAlchemy2 · Alembic |
| Tâches | Celery + Beat (files : notifications, exports, reminders) |
| DB / cache | PostgreSQL 17 + PostGIS 3.5 (RLS · GIST) · Valkey 8 |
| Recherche / stockage | Meilisearch (AR/EN/FR) · MinIO (S3-compatible) |
| Infra | Docker Compose · Nginx · Certbot · Turborepo + pnpm |
| Observabilité | Prometheus · Grafana · Loki + Promtail · Sentry |

## Démarrage rapide

```bash
make up                 # démarre tous les conteneurs
make migrate            # alembic upgrade head
make seed               # données de test Dubaï
make healthcheck        # vérifie les services

pnpm dev                # toutes les apps front (Turborepo)
pnpm dev --filter=sgi-web        # back-office  (5001 local · 3000 Docker)
pnpm dev --filter=@sgi/portal    # portail public (3001)
```

Ports : **web 5001** (3000 en Docker) · **portail 3001** · **api 8000**.

## Tests & qualité

```bash
make test                                                        # suite complète
docker compose exec api uv run pytest app/routers/crm/test_crm.py  # un module backend
pnpm vitest run                                                  # unitaires front
pnpm playwright test                                             # e2e
make lint                                                        # ESLint + Ruff + Prettier
pnpm typecheck                                                   # tsc --noEmit
```

TDD obligatoire (red → green → refactor → commit) ; couverture **≥ 80 %** sur la logique métier, PR
bloquée sinon. Les tests d'intégration endpoint tournent **dans le conteneur** (Postgres réel) ;
les helpers purs tournent partout.

## Architecture (monorepo)

```
apps/
  api/      FastAPI · uv · tests co-localisés app/routers/{module}/test_{module}.py
  web/      Back-office Next.js
  portal/   Portail public Next.js
  mobile/   Expo / React Native (lockfile npm propre)
packages/
  shared-types/   Types TS partagés web/portal
  i18n/           Bundles de traduction AR/EN/FR
infra/      nginx · certbot · monitoring
```

- **Entrée API** : `apps/api/app/main.py` (le lifespan démarre le pool DB + le navigateur Playwright
  du scraping). Tous les routeurs montés sous `/api/v1`.
- **Ordre middleware** (dernier ajouté = premier exécuté) : `CORS → TenantMiddleware → AuditMiddleware
  → GZip` — **ne pas réordonner**.
- **Pattern de module** (`apps/api/app/routers/{module}/`) : `router.py` · `schemas.py` · `service.py`
  (toujours filtré par `company_id`) · `models.py` · `test_{module}.py` · `CLAUDE.md` métier.
- **Migrations** : `apps/api/migrations/versions/` (0001 → head `0067_studio_orchestrator_jobs`).

## Processus de dev & gate de fusion

**Jamais de dev direct sur `main`.** Branche dédiée `type/module-description` → build/tests dans un
worktree isolé → **Agent Test Fonctionnel** (pytest/vitest/tsc/ruff/mypy, couverture ≥ 80 %) →
**Agent Audit Sécurité** (adversarial : 3 Lois + OWASP) → **Locataire Red-Team** (2ᵉ société
éphémère rejoue chaque endpoint en cross-tenant ; réponse ≠ `404` = no-go) → **Carte de Fusion** →
merge scellé par le GO explicite de l'utilisateur. Orchestré par le skill `/centre-de-commande`.

## Documentation

- **[docs/PROJECT_MASTER_PROMPT.md](docs/PROJECT_MASTER_PROMPT.md)** — brief unique de toute la
  solution (mission, 3 Lois, doctrine sécurité, modules, règles métier) de bout en bout.
- **[CLAUDE.md](CLAUDE.md)** — référence opérationnelle (commandes, conventions, wiring API, gate de
  fusion) pour les agents et développeurs.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — runbook de mise en production (activation de la RLS Loi 1).
- **docs/architecture/** + `CLAUDE.md` co-localisés par module — règles métier détaillées.
