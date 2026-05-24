# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SGI** — Système de Gestion Immobilière for **Infinity International Facilities Management UAE**.
Multi-tenant SaaS platform: property catalogue · sales · rentals · CRM · contracts · Golden Visa UAE.

- Market: UAE (Dubai, Abu Dhabi) — international
- Users: 50+ agents, managers, legal, accounting
- Languages: Arabic RTL (primary) · English · French
- Currency: AED (dirham) — always Latin numerals

## Commands

```bash
# Infrastructure
make up               # Start all containers
make down             # Stop all containers
make logs s=api       # Stream FastAPI logs
make healthcheck      # Verify all services

# Database
make migrate          # Alembic upgrade head
make seed             # Load Dubai test data
make backup           # pg_dump compressed → ./backups/

# Dev
pnpm dev                        # All frontend apps (Turborepo)
pnpm dev --filter=web           # Backoffice only (port 3000)
pnpm dev --filter=portal        # Public portal only (port 3001)
make scale n=5                  # 5 FastAPI replicas

# Tests
make test             # Vitest + pytest + Playwright (full suite)
pnpm vitest run       # Frontend unit tests only
pytest tests/routers/test_{module}.py  # Single backend module
pnpm playwright test  # E2E only

# Quality
make lint             # ESLint + Ruff + Prettier

# SSL
make ssl-init         # Let's Encrypt certificates (first run only)
```

Custom slash commands (in `.claude/commands/`):
- `/project:new-module` — scaffold a complete SGI module
- `/project:new-component` — create an RTL-safe component
- `/project:check-tenant` — audit multi-tenant isolation

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2 (App Router · Turbopack) · React 19 · TypeScript 5 |
| UI | shadcn/ui (RTL) · Radix UI · Tailwind CSS v4 |
| State | TanStack Query v5 · Zustand v5 · React Hook Form + Zod v4 |
| i18n | i18next · AR/EN/FR · Noto Sans Arabic · Geist |
| Backend | FastAPI 0.136 · Python 3.13 · Pydantic v2 · Uvicorn + uvloop |
| ORM | SQLAlchemy 2 async · GeoAlchemy2 · Alembic migrations |
| Tasks | Celery + Beat · 3 queues: notifications, exports, relances |
| DB | PostgreSQL 17 + PostGIS 3.5 · RLS · GIST index |
| Cache | Valkey 8 (Redis OSS fork) · sessions · Celery broker |
| Search | Meilisearch (AR/EN/FR · typo-tolerant · self-hosted) |
| Storage | MinIO (S3-compatible · media · contracts · documents) |
| Infra | Docker Compose · Nginx 1.27 · Certbot · Turborepo + pnpm |
| CI/CD | GitHub Actions |
| Tests | Vitest · pytest-asyncio · Playwright |
| Linting | ESLint v9 flat config · Ruff |
| Monitoring | Prometheus · Grafana · Loki + Promtail · Sentry |

## 3 Architectural Laws — Violating Any Is a PR Blocker

### Law 1 — Multi-Tenant: `company_id` everywhere

Every business table requires `company_id UUID NOT NULL` + index + PostgreSQL RLS.
FastAPI middleware injects `company_id` from JWT into every request via `SET LOCAL`.
Never query without a `company_id` filter.
Exempt tables: `companies` · `users` · `audit_logs` · `countries`

Required migration after every business `CREATE TABLE`:
```sql
ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {t}
  USING (company_id = current_setting('app.current_company_id')::UUID);
CREATE INDEX idx_{t}_company ON {t}(company_id);
```

### Law 2 — PostGIS: geospatial data in the database

- Column: `location GEOMETRY(Point, 4326)` on the `properties` table
- Index: `CREATE INDEX ON properties USING GIST(location)` — mandatory
- Distance: always cast `::geography` (metres) — never `::geometry` (degrees)
- Geocode once via Google Maps API at creation time, store result in DB

Radius query template:
```sql
SELECT id, ST_AsGeoJSON(location)::json AS geo,
  ST_Distance(location::geography, ST_MakePoint(:lng,:lat)::geography) AS dist_m
FROM properties
WHERE company_id = :cid AND deleted_at IS NULL
  AND ST_DWithin(location::geography, ST_MakePoint(:lng,:lat)::geography, :radius_m)
ORDER BY dist_m LIMIT :n;
```

### Law 3 — RTL Arabic: logical CSS only, never physical

**Forbidden** in shared components: `ml-* mr-* pl-* pr-* left-* right-* text-left text-right border-l border-r`

**Required instead**: `ms-* me-* ps-* pe-* start-* end-* text-start text-end border-s border-e`

- `DirectionProvider` wraps the RootLayout
- Noto Sans Arabic font loaded for `AR` locale
- Run `npx shadcn@latest migrate rtl` once during initial setup

## Conventions

### Database

- IDs: UUID v4 via `gen_random_uuid()` (PostgreSQL side)
- Every table: `created_at` + `updated_at` timestamps
- Soft delete: `deleted_at TIMESTAMPTZ` nullable — **never physical DELETE**
- Amounts: `DECIMAL(15,2)` in AED — convert only at display time
- Multilingual entities: `title_ar` / `title_en` / `title_fr` columns

### Backend Python

- Type hints mandatory everywhere — mypy strict
- Pydantic v2 schemas for all API inputs/outputs
- Standard response: `{success, data, meta{total,page,limit}}` or `{success, error{code,message}}`
- Always `async def` on endpoints — never sync with I/O
- Celery for any processing > 500ms (PDF, email, WhatsApp)
- Package manager: `uv` (not pip or poetry)

### Frontend TypeScript

- `tsconfig strict: true` — no `any` except documented exceptions
- Server Components by default — `"use client"` only when necessary
- Currency: `Intl.NumberFormat("en-AE", {currency:"AED"})` — always Latin numerals

### Git Commits

```
type(module): short description in French
```
Valid types: `feat · fix · test · docs · chore · refactor · perf · ci`
Example: `feat(m2-crm): ajouter calcul lead scoring automatique`

### TDD

Red test → minimum code → green → refactor → commit.
Coverage ≥ 80% on business logic. PRs with < 80% on new files are blocked.

## Module Structure (uniform pattern)

```
apps/api/app/routers/{module}/
  __init__.py
  router.py        # FastAPI endpoints · auth + tenant pre-handlers
  schemas.py       # Pydantic v2 input/output models
  service.py       # Business logic · always filter by company_id
  models.py        # SQLAlchemy models (if module-specific)
  test_{module}.py # pytest-asyncio · isolated multi-tenant fixtures
  CLAUDE.md        # Module-specific business rules
```

## CRM Business Rules

### Auto follow-up sequence (max 4 attempts over 7 days)

| Day | Action |
|---|---|
| J+1 | Phone call (task created for agent) |
| J+2 | WhatsApp (Meta-approved template, sent via Celery) |
| J+4 | Personalised email (Jinja2 multilingual, Celery) |
| J+7 | Push + WhatsApp (last resort) |

After sequence: `status='lost'`, `reason='non_respondent'` — automatic.

### Lead scoring (0–100 pts)

| Criterion | Points |
|---|---|
| Budget ≥ 2,000,000 AED (Golden Visa threshold) | +25 |
| Budget ≥ 500,000 AED | +15 |
| Golden Visa eligible nationality | +20 |
| Property type specified | +15 |
| Response rate × 20 | +0–20 |
| 2+ contact channels | +10 |
| Contact < 7 days | +10 |

### Pipeline transitions (only these are valid)

```
new → contacted → qualified → proposal_sent
proposal_sent → visit_planned | negotiation | lost
visit_planned → visit_done | lost
visit_done → negotiation | proposal_sent | lost
negotiation → won | lost
won → (terminal)   lost → (terminal)
```

### Post-close automations (`won`)

- Sale ≥ 2,000,000 AED → Golden Visa workflow
- Commercial rental → company creation offer
- Any rental → renewal alert at J-120

## Golden Visa Rules

- Eligibility: property ≥ 2,000,000 AED signed
- Required documents: passport · DLD · GDRFA · insurance · biometric photo
- Alerts: J-90 and J-30 before visa expiry

## Anti-Patterns — Always Refuse

```python
# ❌ Missing company_id filter
SELECT * FROM properties

# ❌ Physical DELETE (use soft delete)
DELETE FROM prospects WHERE id = $1

# ❌ Physical CSS (breaks RTL)
<div className="ml-4 text-left">

# ❌ Raw lat/lng floats instead of PostGIS
location FLOAT lat, FLOAT lng

# ❌ N+1 query in a loop
await db.execute(query)  # inside for loop

# ❌ Hardcoded secret
api_key = "sk-..."  # use os.getenv()

# ❌ "use client" on data-heavy pages (wastes RSC)
# ❌ Anonymous Docker volumes (data loss risk)
# ❌ Business table without company_id (Law 1 violation)
# ❌ Valkey cache without TTL (memory leak)
```

## Skills (load on demand from `.claude/skills/`)

| Skill | Quand l'utiliser |
|---|---|
| `saas-architect` | Conception d'architecture, décision technique, planification AI, nouveau module stratégique |
| `multi-tenant-guard` | Audit isolation multi-tenant, vérification RLS |
| `postgis-queries` | Requêtes géospatiales, index GIST, calculs de distance |
| `fastapi-patterns` | Patterns FastAPI, middlewares, dépendances async |
| `rtl-components` | Composants RTL-safe, CSS logique, i18n |
| `audit-trail` | Système d'audit, traçabilité des actions |
| `nginx-security` | Configuration Nginx, headers sécurité, rate-limiting |
| `crm-business-rules` | Règles pipeline CRM, scoring, relances |
| `docker-compose-ops` | Opérations Docker, healthchecks, réseaux |
| `test-coverage` | Stratégie tests, couverture, fixtures multi-tenant |
| `perf-optimizer` | Optimisation performances, caching, N+1 queries |
| `dev-process` | **Toute demande complexe** : questions → sous-questions → solution → plan → confirmation → dev → déploiement → tests → audit sécurité → validation. Son à chaque étape. |
