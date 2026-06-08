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
pnpm dev --filter=sgi-web       # Backoffice only (port 5001 local · 3000 in Docker)
pnpm dev --filter=@sgi/portal   # Public portal only (port 3001)

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

## Sécurité transversale — doctrine `@core/security`

> **Statut : doctrine cible.** Le SDK `@core/security`, les manifestes par module, Vault, OPA/Cedar et Keycloak **n'existent pas encore** — voir l'encart « Cible vs implémenté » et la doctrine complète dans [docs/architecture/security-core.md](docs/architecture/security-core.md). Ne jamais affirmer en code/commit qu'une primitive cible existe. Les **3 invariants ci-dessous SONT déjà la réalité** (ce sont les 3 Lois).

**7 principes non négociables :** Zero Trust · Defense in depth · Secure-by-default · **Fail-secure** (doute/erreur → refuser) · OODA continue · **humain dans la boucle** (actions destructrices déclenchées par un humain) · Privacy by design (PDPL).

**3 invariants verrouillés — jamais désactivables** (= les 3 Lois, déjà appliqués) : **Identité** (JWT + Infinity ID sur tout endpoint) · **Isolation tenant** (RLS `company_id` + `TenantMiddleware`) · **Audit** (`audit_logs` + `AuditMiddleware`). Toute proposition qui les contourne, même temporaire → refus au niveau code.

**Contrôles tunables** (MFA renforcée, rate-limit strict, validation, honeytokens, UEBA, step-up) : désactivables **seulement** via workflow d'approbation à 2 + trace `audit_logs` (auteur/raison/ticket) + TTL ≤ 72h + alerte critique + événement réglementaire si PDPL.

**Règles d'or sur tout module** : scoping `company_id` du contexte (jamais une valeur client) · aucun secret en dur (`os.getenv()`/Vault) · chiffrer les champs sensibles (Emirates ID, IBAN, PDC) · émettre les events d'audit aux points sensibles · **test cross-tenant obligatoire** (Red-Team Loi 1 : réponse ≠ 404 = no-go) · dans le doute, demander.

**Refus systématique** : code qui court-circuite auth/isolation/audit · secrets en dur · expose un port sensible (5038 AMI, 5432 PG, 6379 Valkey) publiquement · désactive un contrôle hors gouvernance · contourne la RLS · dépendance à CVE critique non patchée. Conformité UAE par design : **PDPL** (notification UAE Data Office sans délai), KYC/AML/goAML, TDRA (SRTP, AMI cloisonné), RERA/Ejari/DLD/DEWA/ADDC.

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

**Two test layers (both live in `test_{module}.py`, co-located in the router):**
- *Pure helpers* — state machines, scoring, reference generation. No DB, fast, run anywhere.
- *Endpoint integration* — HTTP-level via the shared harness in [apps/api/conftest.py](apps/api/conftest.py). Need a **real Postgres** so they run **inside the container** (`docker compose exec api uv run pytest …`), never on the host. Fixtures: `client` (ASGI httpx), `db_session` (NullPool, isolated per test), `seed_admin` (company + admin + JWT), `second_admin` (a 2nd tenant — assert its data is invisible to verify Law 1), `unique_email`. Each test commits, so always use the `unique_*` fixtures to avoid cross-test collisions.

Alembic migrations live in **`apps/api/migrations/versions/`** (not the default `alembic/versions/`). Numbered `NNNN_name.py`; head is `0065_presence_session` (68 migrations, 0001 → 0065). Worker/migrations use the privileged `sgi_user`; the API uses restricted `sgi_app` (see Law 1).

Le coût bcrypt est réglable via `BCRYPT_ROUNDS` (`app/core/config.py`, défaut 12). La suite de tests le baisse à 4 (≈ −13 % de temps) — ne jamais hasher en prod avec un coût aussi bas.

## Processus de développement & Gate de fusion — OBLIGATOIRE

**Règle d'or : on ne développe JAMAIS directement sur `main`.** `main` reste en permanence déployable. Toute nouvelle fonctionnalité (ou groupe de fonctions) suit le cycle ci-dessous. Aucune fusion sans la validation explicite de l'utilisateur.

### 1. Branche dédiée + isolation

- Une **branche par fonctionnalité** : `type/module-description` (mêmes `type` que les commits : `feat·fix·refactor·…`). Ex. `feat/realestate-tenant-portal`.
- **Build & tests dans un git worktree isolé** sur `origin/main`, jamais dans l'arbre de travail principal (le dépôt est enraciné sur `~` et peut churner si plusieurs agents/sessions tournent en parallèle — voir l'incident documenté). Préférer **un fichier neuf** plutôt qu'éditer des fichiers d'une PR déjà ouverte.
- Respect des **3 Lois** dès le développement (company_id+RLS, PostGIS, RTL CSS logique) — ce sont les PR-blockers.
- **Pré-push** : lancer `uv run ruff format` (pas seulement `ruff check`) — la CI exécute `ruff format --check` et échoue en ~30 s sinon, avant pytest.

### 2. Fin de dev → 2 agents séquentiels (gate de fusion)

Lancés dans cet ordre ; l'audit sécurité ne démarre qu'après un test fonctionnel **vert**.

1. **Agent Test Fonctionnel** — prouve que ça marche : `pytest` (en conteneur), `vitest`, `tsc --noEmit`, `ruff format --check` + `ruff check`, **couverture ≥ 80 % sur les fichiers neufs**, et exercice réel des endpoints (codes 200/4xx attendus, machines à états).
2. **Agent Audit Sécurité** — adversarial, calé sur les 3 Lois + OWASP + zones sensibles connues (MFA, BOLA owner/payments/tenant, authz WebSocket, rôle restreint `sgi_app`, secrets, requêtes sans `company_id`).

### 3. 💡 Locataire Red-Team (automatisé) — gate Loi 1 déterministe

L'agent sécurité **provisionne une 2ᵉ société éphémère** et **rejoue chaque nouvel endpoint du diff en cross-tenant et cross-utilisateur** : il tente de lire/écrire la donnée d'un autre tenant (Loi 1) et d'un autre utilisateur du même tenant (BOLA horizontal). **Toute réponse ≠ `404`/vide = no-go bloquant.** Ça transforme le risque n°1 (isolation multi-tenant, le plus dur à voir à l'œil) en vérification machine, au lieu d'une relecture manuelle faillible.

### 4. Carte de Fusion (scorecard) signée par l'utilisateur

Les 2 agents produisent une **Carte de Fusion** postée en commentaire de la PR — tableau **go/no-go par dimension** : tests · couverture · Loi 1 (Red-Team) · Loi 2 · Loi 3 · OWASP · perf · CI verte. Le merge est **scellé par la validation explicite de l'utilisateur** (« GO #PR »). **Aucun agent ne merge de lui-même.**

### 5. Fusion (par l'utilisateur, ou par l'agent après son GO)

- Merger **sans `--delete-branch`** (évite la bascule de checkout sur un `main` local périmé), puis **supprimer la branche distante séparément**.
- Re-synchroniser `main` localement avant la fonctionnalité suivante.

> Réutilisable via le skill **`/centre-de-commande`** (le « Centre de Commande ») qui orchestre tout le cycle — architecte → dev → 📡 RADAR (test) → ✈️ CHASSEUR (audit Red-Team) → 🛡️ DÔME DE FER (intégration supervisée) → test+audit du module → Carte de Fusion → worktree/PR → attente du « GO #PR ». Sa phase GIT finale **est** cette gate de fusion. S'appuie sur les skills `parallel-agents`, `dev-process`, `progression`, `saas-architect`.

## Monorepo Layout

```
apps/
  api/      FastAPI · uv · pytest co-located in app/routers/{module}/test_{module}.py
  web/      Next.js backoffice (port 3000)
  portal/   Next.js public portal (port 3001)
  mobile/   Expo / React Native (own npm lockfile — NOT in the pnpm workspace install graph)
packages/
  shared-types/   TypeScript types shared between web/portal
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
  ai_router.py     # Optional "Agent AI" sub-module (see note below)
  ai_service.py
  ai_schemas.py
  test_{module}_ai.py
```

Existing modules: `auth`, `clients`, `properties`, `crm`, `contracts`, `golden_visa`, `rentals`, `finance`, `reporting`, `scraping`, `owners`, `tenants`, `vendors`, `technicians`, `buildings`, `units`, `pdc`, `maintenance`, `inspections`, `payments`, `comms`, `workflows`, `ai_services`, `partner`, `client_portal`, `owner_portal`, `agenda`, `realestate_core`, `documents`, `owner_statements`, `notifications`, `telephony`, `inbox`, `ticketing`, `acquisitions`, `sales`, `leasing`, `copilot`, `tenant_portal`, `iam`, `developers`, `marketing`, `sources`, `public_site`, `social`, `scenarios`, `accounting`, `admin`, `bank`, `search`, `honeytokens`, `self_defense`, `presence`.

> `accounting` (migration 0047) is a **double-entry** general ledger: each `JournalEntry` carries ≥ 2 balanced `JournalLine`s (Σ debits == Σ credits, each line is debit XOR credit, all `Decimal` — never float). `JournalLine.company_id` is **denormalized** — copied from the parent entry, never from client input — so Law 1 RLS applies directly to the lines table. Pure balance validation lives in `validate_balanced()` (no DB).

> `tenant_kyc` and `contract_renewal_signature` (migrations 0022–0024) are **not** standalone router dirs — they are sub-routes mounted under `tenants`/`contracts`. Don't look for `tenant_kyc/` or `contract_renewal_signature/` directories.

> **Agent AI sub-module** (`clients`, `vendors` — PR #282, no migration). A module can carry an optional AI agent as a **separate router** (`ai_router.py` + `ai_service.py` + `ai_schemas.py` + `test_{module}_ai.py`), mounted independently in [main.py](apps/api/app/main.py) under `/{module}/ai/...`. Tenant-scoped (Loi 1: `company_id` from context), RBAC via `require_roles`, and **404 (never 403) on cross-tenant/unknown id** to avoid the BOLA existence oracle. Gemini calls are non-blocking (short timeout + **deterministic heuristic fallback**), so the pure-logic layer is testable without the LLM. Real outbound = email (`Notification` + Celery) ; WhatsApp requires an approved Meta template. PDPL guard `app/core/pdpl.py`. Détails : [docs/architecture/agent-ai.md](docs/architecture/agent-ai.md).

> `bank` (migration 0050) is bank-statement import + reconciliation against payments/ledger; `search` is the Meilisearch front (`GET /search` unified typeahead over biens/clients/contrats + `POST /search/reindex` per-company) — its index logic lives in `search/meili.py`, no migration. `admin` (migration 0048) is the admin console **aggregator** (sub-routers `users`/`audit`/`alerts`/`backups`/`infra`/`prometheus`) — see its co-located `CLAUDE.md`.

> **Sécurité active — `honeytokens` · `self_defense` · `presence`** (migrations 0062, 0064, 0065 ; `0063_user_oauth_link` lie un compte à un provider OAuth). `honeytokens` (leurres) : l'endpoint `GET /honeytokens/trip/{token}` est **public (sans JWT)** et renvoie toujours une **réponse neutre 404** — aucun oracle ne révèle qu'un piège existe ni à quelle société il appartient ; l'alerte part en fond. `self_defense` : `POST /self-defense/event` écrit dans `audit_logs` (table RLS-exempte, isolée par `company_id` au niveau ligne) ; **aucun code/secret n'est transmis ni stocké**. `presence` : `POST /presence/heartbeat` (tout user) + `GET /presence/active?advanced=1` **réservé admin/manager** (les IP/positions ne fuitent pas aux non-admins) ; IP lue côté serveur (`X-Forwarded-For`). Les trois respectent la Loi 1 via `get_db_session`. Chaque module a un `admin_router.py` (sauf `presence`).

> **Infinity ID / UAE Infinity PASS** (migrations 0048 split-finance aside; identity proper at 0059) — an **internal** IdP inspired by UAE PASS (assurance levels L0–L3, step-up on sensitive actions, in-house qualified signature), **not** federated to the government `id.uaepass.ae`. Assurance scale + step-up logic live in `app/core/assurance.py`. See [docs/architecture/infinity-id.md](docs/architecture/infinity-id.md).

### Per-module deep reference (moved out of this file)

To keep this root file lean, the detailed per-module references now live next to the
code (co-located `CLAUDE.md`, auto-loaded when working in that dir) or under
`docs/architecture/` for cross-cutting groups. Read the relevant one before touching a module.

**Cross-cutting (`docs/architecture/`):**
- [realestate-foundations.md](docs/architecture/realestate-foundations.md) — party-role pattern (`owners`/`tenants`/`vendors`/`technicians`, migration 0002) + physical hierarchy (`buildings`/`floors`/`units`, migration 0003).
- [operations-modules.md](docs/architecture/operations-modules.md) — `maintenance`·`inspections`·`payments`·`comms`·`workflows`·`ai_services`·`partner`·`client_portal`·`owner_portal` (0013–0019), auth hardening / refresh tokens / C1 RLS, and the Rubrique Immobilier nav (6 sections, migrations 0020–0026).
- [transactions.md](docs/architecture/transactions.md) — `acquisitions`·`sales`·`leasing` (0033–0035), inline references under advisory lock.
- [lead-acquisition.md](docs/architecture/lead-acquisition.md) — `marketing`·`sources`·`public_site` (0038–0041), public vitrine in `apps/portal`.
- [infinity-id.md](docs/architecture/infinity-id.md) — UAE Infinity PASS: internal IdP, assurance levels L0–L3 (`core/assurance.py`), step-up, in-house qualified signature (migration 0059). Not federated to government UAE PASS.
- [security-core.md](docs/architecture/security-core.md) — doctrine transversale `@core/security` (Zero Trust, invariants verrouillés, contrôles tunables, radar/chasseur/playbooks, conformité UAE, règles d'or Claude Code). **Doctrine cible** : encart « Cible vs implémenté » en tête pour distinguer l'aspirationnel (SDK, manifestes, Vault) du réel (`company_id`, JWT/Infinity ID, RLS, `audit_logs`).
- [agent-ai.md](docs/architecture/agent-ai.md) — sous-catégorie **Agent AI** Clients & Fournisseurs (`{clients,vendors}/ai/*`) : scoring/risque, validation, insights, **envoi email réel** (Celery ; WhatsApp = template requis), **garde PDPL** (`core/pdpl.py`), actions cliquables, sélecteur d'entité. Gemini + repli heuristique.
- [studio.md](docs/architecture/studio.md) — **Studio de Modules + superviseur de sécurité** (plateforme, sous-routeurs `admin/{studio,security}.py`, migrations 0066/0067). Chaîne concevoir (lite/IA) → gouverner (4-eyes) → générer du **vrai code CRUD** via le worker isolé `worker-studio` (fail-secure, whitelist d'argv, **jamais d'auto-merge** — ouvre une PR) → utiliser (écran générique) → superviser (dashboard `audit_logs` cross-tenant). Flag `STUDIO_CODEGEN_ENABLED` (off par défaut).

**Co-located module `CLAUDE.md` (under `apps/api/app/routers/{module}/`):**
- `pdc/` — post-dated cheques, UAE state machine (migration 0003).
- `telephony/` — Asterisk WebRTC contact centre + PDPL recording (migration 0028).
- `inbox/` — omnichannel inbox + WhatsApp webhook + realtime WS (migration 0031).
- `ticketing/` — client service desk, SLA escalation (migration 0032).
- `copilot/` — agent assist over inbox/tickets, Gemini + heuristic fallback (no migration).
- `tenant_portal/` — tenant self-service, strict BOLA scoping (no migration).
- `iam/` — hierarchical RBAC, resource tree + inheritance (migration 0036).
- `developers/` — real-estate developers directory (migration 0037).
- `admin/` — admin console; security boundary lives in the aggregator router, sub-routers `users`/`audit`/`alerts`/`backups`/`infra`/`prometheus` (migrations 0048, 0051, 0053, 0056).

## API Wiring

- Entry: [apps/api/app/main.py](apps/api/app/main.py) — lifespan starts the DB pool and the Playwright browser (used by `scraping`).
- **Middleware order matters** (last added = first executed): `CORSMiddleware` → `TenantMiddleware` → `AuditMiddleware` → `GZipMiddleware`. `TenantMiddleware` ([app/middleware/tenant.py](apps/api/app/middleware/tenant.py)) decodes the JWT and `SET LOCAL app.current_company_id` per request — this is the runtime enforcement of Law 1. Do not reorder.
- Shared deps in [app/core/deps.py](apps/api/app/core/deps.py), config in [app/core/config.py](apps/api/app/core/config.py), DB pool in [app/core/database.py](apps/api/app/core/database.py).
- Celery app: [app/tasks/celery_app.py](apps/api/app/tasks/celery_app.py). Worker runs queues `notifications,exports,reminders`; `beat` is a separate container. Task modules: `notifications`, `exports`, `reminders`, `comms`, `maintenance`, `workflows`, `audit`, `telephony`, `inbox`, `ticketing` (escalade SLA tickets, queue `reminders`, beat horaire), `scenarios`, plus the admin/infra-console tasks `alerts`, `backups`, `infra_control`, and `watcher`. Modules without a dedicated queue route to `reminders` (see the `task_routes` map in `celery_app.py`).
- All routers mounted under `/api/v1`. Health: `GET /health`. Docs only when `DEBUG=true`.
- Alembic migrations live in [apps/api/migrations/versions/](apps/api/migrations/versions/) (NOT `alembic/versions/`) — 0001 → 0065. `make migrate` runs `alembic upgrade head` via the privileged `sgi_user` role.
- **Production RLS activation runbook**: [DEPLOYMENT.md](DEPLOYMENT.md) — the one-step gotcha for going live (set `APP_DB_PASSWORD` so the API uses `sgi_app` and Law 1 RLS is actually enforced).

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
| `centre-de-commande` | **Développement orchestré « mode architecte » + visuel terminal créatif** : découpe en fonctions simples, puis par fonction 📡 RADAR (test fonctionnel) → ✈️ CHASSEUR (audit sécurité Red-Team, l'avion attaque) → 🛡️ DÔME DE FER (intégration supervisée + résumé, le dôme se ferme = fonction verrouillée), puis test+audit du module, Carte de Fusion, worktree/PR et merge après « GO #PR ». Invocable `/centre-de-commande`. Compose `saas-architect`/`parallel-agents`/`progression`/`dev-process`. Sa phase GIT finale = la gate de fusion (ex-`/gate-fusion`). |
