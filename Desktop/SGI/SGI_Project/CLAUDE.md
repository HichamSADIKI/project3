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

# Dev (web/portal use pnpm via Turborepo)
pnpm dev                        # All frontend apps (Turborepo)
pnpm dev --filter=web           # Backoffice only (port 5001 local · 3000 in Docker)
pnpm dev --filter=portal        # Public portal only (port 3001)

# Mobile (apps/mobile uses npm — separate lockfile, Expo 51 + Expo Router)
cd apps/mobile && npm install
npm start                       # Expo dev server
npm run ios                     # iOS simulator
npm run android                 # Android emulator
npm run typecheck               # tsc --noEmit

# Tests
make test                                              # Full suite (pnpm turbo test + pytest in container)
pnpm vitest run                                        # Frontend unit tests only
docker compose exec api uv run pytest app/routers/crm/test_crm.py   # Single backend module (tests are co-located)
pnpm playwright test                                   # E2E only

# Infra scaling
make scale n=5        # Scale FastAPI to N replicas

# Quality
make lint             # ESLint + Ruff + Prettier

# SSL
make ssl-init         # Let's Encrypt certificates (first run only)
```

MCP servers configured in `.mcp.json`:
- `gemini` — custom Node server at `.claude/mcp-servers/gemini/`. Exposes domain tools: `gemini_analyze_property`, `gemini_score_lead`, `gemini_generate_contract_summary`, `gemini_whatsapp_message`, `gemini_translate`, `gemini_generate`.
- `puppeteer` — `@modelcontextprotocol/server-puppeteer` (headed Chrome).

`.claude/commands/` is currently empty — no project slash commands are scaffolded yet.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15.3 (App Router · Turbopack) · React 19 · TypeScript 5 |
| UI | shadcn/ui (RTL) · Radix UI · Tailwind CSS v4 |
| State | TanStack Query v5 · Zustand v4 · Zod v3 |
| i18n | i18next · AR/EN/FR · Noto Sans Arabic · Geist |
| Mobile | Expo 51 · React Native 0.74 · Expo Router · NativeWind · react-native-maps · MMKV · expo-secure-store |
| Backend | FastAPI 0.136 · Python 3.13 · Pydantic v2 · Uvicorn + uvloop |
| ORM | SQLAlchemy 2 async · GeoAlchemy2 · Alembic migrations |
| Tasks | Celery + Beat · 3 queues: notifications, exports, reminders |
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

**Runtime enforcement — split de rôles (migration 0022).** La RLS n'est réellement
appliquée que si la connexion n'est ni superuser ni propriétaire des tables. L'API
se connecte donc via le rôle restreint **`sgi_app`** (`NOSUPERUSER`, `NOBYPASSRLS`,
non-propriétaire — `APP_DATABASE_URL`/`APP_DB_PASSWORD`). Le **worker Celery** et les
**migrations** gardent `sgi_user` (privilégié) car les tâches cron scannent toutes les
sociétés. `get_db` épingle une connexion par requête et `get_db_session` pose
`app.current_company_id` au niveau session (survit aux commits). **En prod, définir
`APP_DB_PASSWORD`** sinon l'API retombe sur le rôle privilégié et la RLS est inerte.

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

## Monorepo Layout

```
apps/
  api/      FastAPI · uv · pytest co-located in app/routers/{module}/test_{module}.py
  web/      Next.js backoffice (port 3000)
  portal/   Next.js public portal (port 3001)
  mobile/   Expo / React Native (own npm lockfile — NOT in the pnpm workspace install graph)
packages/
  shared-types/   TypeScript types shared between web/portal
  ui/             Shared shadcn-based components
  i18n/           AR/EN/FR translation bundles
infra/      nginx · certbot · monitoring (prometheus/grafana/loki) configs
```

## API Module Structure (uniform pattern)

```
apps/api/app/routers/{module}/
  __init__.py
  router.py        # FastAPI endpoints · auth + tenant pre-handlers
  schemas.py       # Pydantic v2 input/output models
  service.py       # Business logic · always filter by company_id
  models.py        # SQLAlchemy models (if module-specific)
  test_{module}.py # pytest-asyncio · isolated multi-tenant fixtures
  CLAUDE.md        # Module-specific business rules (when present)
```

Existing modules: `auth`, `clients`, `properties`, `crm`, `contracts`, `golden_visa`, `rentals`, `finance`, `reporting`, `scraping`, `owners`, `tenants`, `vendors`, `technicians`, `buildings`, `units`, `pdc`, `maintenance`, `inspections`, `payments`, `comms`, `workflows`, `ai_services`, `partner`, `client_portal`, `owner_portal`, `agenda`, `realestate_core`, `documents`, `owner_statements`, `notifications`.

### RealEstate party-role pattern (migration 0002)

`clients` is the umbrella **party** table (any individual or company the agency interacts with). Each business role is a **profile table** with PK = FK to the party, so a single client can hold multiple roles without duplication:

| Table | Extends | Purpose |
|---|---|---|
| `owners` | `clients.id` | Property owner. Carries mandate, IBAN, payout preferences. |
| `tenant_profiles` | `clients.id` | Tenant / candidate. Lifecycle: `candidate → active → former / blacklisted`. Loyalty score 0-100. |
| `vendors` | `clients.id` | External provider (maintenance, cleaning, security…). Trade licence, rating cumulé, marketplace eligibility. |
| `technicians` | `users.id` | **Internal salaried staff**, not a client. Skills + mobile app KPIs. |

Routes: `/api/v1/{owners,tenants,vendors,technicians}` — CRUD + specific endpoints (`POST /tenants/{id}/status` for lifecycle transitions, `POST /vendors/{id}/ratings`, `POST /technicians/{id}/ratings`).

Pure business helpers (testable without DB) live in `service.py`:
- `owners.service`: `mandate_is_active`, `days_until_mandate_expiry`, `needs_renewal_alert`
- `tenants.service`: `is_valid_transition`, `compute_loyalty_score`, `visa_alert_level`
- `vendors.service`: `merge_rating` (numerically stable cumulative avg, reused by technicians), `cancellation_rate`, `is_eligible_for_marketplace`

Shared FastAPI deps: `app/core/route_deps.py` (`get_company_id`, `require_roles`). New routers use this; legacy routers keep their inline copy for now.

### RealEstate physical hierarchy (migration 0003)

| Table | Parent | Purpose |
|---|---|---|
| `buildings` | — | Physical asset (tower, compound, mixed-use). PostGIS `location` + optional `footprint` polygon. DLD reference. Links to `owners`. |
| `floors` | `buildings.id` (CASCADE) | Optional intermediate level — present for towers, absent for villa compounds. Unique `(building_id, floor_number)`. |
| `units` | `buildings.id` (RESTRICT) + optional `floors.id` | Rentable / sellable atom. Holds Ejari/DEWA/ADDC account numbers, inventory JSONB, list rent/sale prices. Optional `legacy_property_id` FK bridges to the legacy `properties` table for progressive migration. |

The legacy `properties` table is untouched. New modules (maintenance, inspections, meters, parking — to come) target `units`. Routes: `/api/v1/buildings`, `/api/v1/buildings/{id}/floors`, `/api/v1/buildings/{id}/occupancy`, `/api/v1/units`, `/api/v1/units/{id}/status`.

Pure helpers: `buildings.service.compute_occupancy` (occupied+reserved vs vacant; excludes maintenance/renovation/off_market from denominator), `units.service.is_valid_status_transition` (state machine `vacant → reserved → occupied → vacant | maintenance → renovation → vacant`, `off_market → vacant`).

### PDC — Post-dated cheques (migration 0003)

`pdc_cheques` is the UAE-specific first-class entity. One PDC links to **exactly one** of `rentals` or `contracts` (check-constraint), plus a drawer (`clients.id`). State machine:

```
pending ─┬─→ deposited ─┬─→ cleared        (terminal)
         │              └─→ bounced ─→ replaced  (terminal — chained via replaced_by_pdc_id)
         └─→ cancelled                            (terminal)
```

Routes: `/api/v1/pdc` (CRUD), plus state actions `/pdc/{id}/{deposit,clear,bounce,cancel,replace,legal-notice}`. Reference auto-generated as `PDC-YYYY-NNNNNN` (6 digits, lexicographically sortable). Calendar endpoint `/api/v1/pdc/calendar?horizon_days=60` returns active cheques due in the window, used by Celery beat to schedule deposit reminders and overdue alerts (UAE Federal Penal Code art. 401 — bounced cheque = offence; `legal_notices_sent` counter tracks the workflow).

Pure helpers in `pdc.service`: `is_valid_pdc_transition`, `days_to_due`, `is_overdue`, `generate_reference`, `aggregate_outstanding`.

### Operations modules (migrations 0013–0019)

All follow the same router/schemas/service/test pattern, mount under `/api/v1`, filter by `company_id`, and keep pure (DB-free) helpers in `service.py` — verify the state machine helper before changing any lifecycle.

| Module | Route prefix | Migration | Notes |
|---|---|---|---|
| `maintenance` | `/maintenance` | 0013–0014 | Tickets + quotes/invoices/preventive plans. Helpers: `generate_reference`, `is_valid_transition`, `compute_sla_due`, `is_sla_breached`. Celery task module `tasks/maintenance.py`. |
| `inspections` | `/inspections` | 0018 | Inspection → sections → items → photos (move-in/out, periodic). State-machine helpers in service. |
| `payments` | `/payments` | 0019 | Payment requests + transactions + summaries. Backs the owner portal. |
| `comms` | `/comms` | 0015 | In-app conversations + **WebSocket**. Fan-out across `make scale` replicas via Valkey pub/sub (`conv:{cid}:{conv_id}`); presence/typing keys carry TTLs — see [app/routers/comms/ws.py](apps/api/app/routers/comms/ws.py). Celery task `tasks/comms.py`. |
| `workflows` | `/workflows` | 0016 | Generic workflow engine: templates → instances → steps → events. Celery task `tasks/workflows.py`. |
| `ai_services` | `/ai` | — | Gemini-backed endpoints (contract summary, lead scoring, maintenance prediction). Wired to the `gemini` MCP server tools. |
| `partner` | `/fournisseur` | 0005–0006, 0010–0012 | Fournisseur (vendor) self-service: KYC docs, missions, categories. Role renamed `partner → fournisseur` (0006). |
| `client_portal` | `/client` | — | Authenticated client self-service: profile, needs, listings. |
| `owner_portal` | `/owner` | — | Owner self-service: payouts, **statements + notifications** (M6/M7), expense approval. Reuses `owner_statements`/`notifications` services; strict owner scoping (anti-BOLA). |

Auth hardening: MFA (migration 0017). Recent security work fixed MFA bypass, BOLA on owner/payments, and WebSocket authz — preserve the tenant-context (`SET LOCAL`) checks when touching these routers. **C1 (migration `0023_app_role_rls`): the API connects via the restricted `sgi_app` role (`NOSUPERUSER`/`NOBYPASSRLS`) so RLS is actually enforced — set `APP_DB_PASSWORD` in prod or RLS falls back inert.**

### Rubrique Immobilier — chantier d'intégration (migrations 0020–0026)

Catégorie principale **Immobilier** du backoffice (`apps/web`), 12 modules livrés. Tous suivent le pattern router/schemas/service/test, filtrent par `company_id`, helpers purs testés.

| Module / Migration | Route prefix | Notes |
|---|---|---|
| `realestate_core` (0020) | `/branches`, `/company-settings` | Succursales (multi-branch, PostGIS) + paramètres UAE (TVA 5 %, Ejari, DLD). Singleton settings par tenant. |
| `documents` (0021) | `/documents` | Documents génériques (lien polymorphe `entity_type`+`entity_id`) + versioning immuable (sha256) + **e-signature interne UAE** (hash + OTP + audit). Réutilise `app.core.storage` (MinIO). |
| `tenant_kyc` (0022) | `/tenants/{id}/kyc` | Workflow KYC locataire (not_started→pending→verified\|rejected), checklist docs (Emirates ID + passeport via `documents`) + alertes expiration. |
| `contract_renewal_signature` (0023) | `/contracts/{id}/{renew,request-signature,sync-signature}` | Renouvellement de contrats (+ bail lié, escalade loyer) + e-signature via `documents`. Tâche `check_rental_renewals` (J-120). |
| `owner_statements` (0025) | `/owners/{id}/statements` | Relevés mensuels propriétaires (revenus − dépenses − commission = payout net), statut draft→sent. |
| `notifications` (0025) | `/notifications` | Notifications in-app génériques réutilisables (statement_ready, pdc_due, maintenance_sla_breach, message_mention, workflow_escalation…). |

Tâches Celery beat ajoutées (queue `reminders`) qui alimentent `notifications` : `check_rental_renewals` (J-120), `check_pdc_due` (échéance/retard chèques), et l'enrichissement de `check_maintenance_sla` / `check_workflow_sla` / `notify_mentions`.

**Frontend** : la rubrique **Immobilier** (`apps/web`, `components/sgi-ui.tsx` + `app/screens/realestate-*.tsx`) regroupe 14 sous-catégories : Bâtiments · Unités · Locataires · Propriétaires · Portail Propriétaire · Contrats · Paiements · Chèques · Maintenance · Communication · Validations · Succursales · Documents · Paramètres. Migration de merge `0026_merge_0025` réconcilie le fork `owner_statements` / `reference_composite_unique`.

## API Wiring

- Entry: [apps/api/app/main.py](apps/api/app/main.py) — lifespan starts the DB pool and the Playwright browser (used by `scraping`).
- **Middleware order matters** (last added = first executed): `CORSMiddleware` → `TenantMiddleware` → `AuditMiddleware` → `GZipMiddleware`. `TenantMiddleware` ([app/middleware/tenant.py](apps/api/app/middleware/tenant.py)) decodes the JWT and `SET LOCAL app.current_company_id` per request — this is the runtime enforcement of Law 1. Do not reorder.
- Shared deps in [app/core/deps.py](apps/api/app/core/deps.py), config in [app/core/config.py](apps/api/app/core/config.py), DB pool in [app/core/database.py](apps/api/app/core/database.py).
- Celery app: [app/tasks/celery_app.py](apps/api/app/tasks/celery_app.py). Worker runs queues `notifications,exports,reminders`; `beat` is a separate container. Task modules: `notifications`, `exports`, `reminders`, `comms`, `maintenance`, `workflows`.
- All routers mounted under `/api/v1`. Health: `GET /health`. Docs only when `DEBUG=true`.

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

Only the skills below actually exist on disk — verified against `.claude/skills/`.

| Skill | Quand l'utiliser |
|---|---|
| `saas-architect` | Conception d'architecture, décision technique, planification AI, nouveau module stratégique |
| `multi-tenant-guard` | Audit isolation multi-tenant, vérification RLS |
| `postgis-queries` | Requêtes géospatiales, index GIST, calculs de distance |
| `fastapi-patterns` | Patterns FastAPI, middlewares, dépendances async |
| `rtl-components` | Composants RTL-safe, CSS logique, i18n |
| `dev-process` | **Toute demande complexe** : questions → sous-questions → solution → plan → confirmation → dev → déploiement → tests → audit sécurité → validation. Son à chaque étape. |
| `parallel-agents` | **Orchestration multi-agents** : analyse + dev + tests + audit sécurité/i18n/perf + validation TS + intégration GitHub en parallèle. Charger quand la tâche couvre ≥ 2 dimensions. |
| `progression` | **Tableau de bord graphique** du taux de réalisation (tâche principale + sous-tâches) dans le terminal : barres Unicode + %. Invocable `/progression`. À afficher au début d'une demande multi-étapes (≥ 2 sous-tâches), à chaque fin de phase, et quand l'utilisateur demande « où on en est » / « taux de réalisation ». Se combine avec `dev-process`. |
