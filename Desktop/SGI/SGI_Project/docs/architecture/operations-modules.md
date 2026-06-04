# Operations modules (migrations 0013–0019)

> Extracted from the root `CLAUDE.md`. Cross-cutting reference for the operational modules.

All follow the same router/schemas/service/test pattern, mount under `/api/v1`, filter by `company_id`, and keep pure (DB-free) helpers in `service.py` — verify the state machine helper before changing any lifecycle.

| Module | Route prefix | Migration | Notes |
|---|---|---|---|
| `maintenance` | `/maintenance` | 0013–0014 | Tickets + quotes/invoices/preventive plans. Helpers: `generate_reference`, `is_valid_transition`, `compute_sla_due`, `is_sla_breached`. Celery task module `tasks/maintenance.py`. |
| `inspections` | `/inspections` | 0018 | Inspection → sections → items → photos (move-in/out, periodic). State-machine helpers in service. |
| `payments` | `/payments` | 0019 | Payment requests + transactions + summaries. Backs the owner portal. |
| `comms` | `/comms` | 0015 | In-app conversations + **WebSocket**. Fan-out across `make scale` replicas via Valkey pub/sub (`conv:{cid}:{conv_id}`); presence/typing keys carry TTLs — see [app/routers/comms/ws.py](../../apps/api/app/routers/comms/ws.py). Celery task `tasks/comms.py`. |
| `workflows` | `/workflows` | 0016 | Generic workflow engine: templates → instances → steps → events. Celery task `tasks/workflows.py`. |
| `ai_services` | `/ai` | — | Gemini-backed endpoints (contract summary, lead scoring, maintenance prediction). Wired to the `gemini` MCP server tools. |
| `partner` | `/fournisseur` | 0005–0006, 0010–0012 | Fournisseur (vendor) self-service: KYC docs, missions, categories. Role renamed `partner → fournisseur` (0006). |
| `client_portal` | `/client` | — | Authenticated client self-service: profile, needs, listings. |
| `owner_portal` | `/owner` | — | Owner self-service: payouts, **statements + notifications** (M6/M7), expense approval. Reuses `owner_statements`/`notifications` services; strict owner scoping (anti-BOLA). |

Auth hardening: MFA (migration 0017). Recent security work fixed MFA bypass, BOLA on owner/payments, and WebSocket authz — preserve the tenant-context (`SET LOCAL`) checks when touching these routers. **Refresh tokens (migration `0027_refresh_tokens`): access JWT court (`JWT_ACCESS_EXPIRE_HOURS=1`) + refresh opaque 30 j stocké haché SHA-256 dans `refresh_tokens` (rotation one-time-use, détection de réutilisation → révocation de famille via `family_id`). Endpoints `/auth/{refresh,logout}` + gestion de sessions `GET /auth/sessions` (familles de refresh tokens actives) et `POST /auth/sessions/revoke-all`. Helpers purs dans `auth/refresh_service.py`. Côté web : cookie `sgi-refresh` httpOnly scopé `/api/auth`, route proxy `/api/auth/refresh` (publique dans `middleware.ts`), et `getJson`/`postJson` rejouent après un refresh transparent sur 401 (`apps/web/lib/api-client.ts`).** **C1 (migration `0023_app_role_rls`): the API connects via the restricted `sgi_app` role (`NOSUPERUSER`/`NOBYPASSRLS`) so RLS is actually enforced — set `APP_DB_PASSWORD` in prod or RLS falls back inert.**

## Rubrique Immobilier — chantier d'intégration (migrations 0020–0026)

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

**Frontend** : la rubrique **Immobilier** (`apps/web`, `components/sgi-ui.tsx` + `app/screens/realestate-*.tsx`) regroupe ses entrées de nav en **6 sections thématiques** (clé `section` sur chaque `NavItem`, libellés `nav_re_sec_*` AR/EN/FR dans `lib/i18n.ts` ; intertitre + séparateur + tiret doré rendus dans `GroupRow`) : `patrimoine` (Bâtiments · Unités · Succursales), `transactions` (CRM · Achat · Vente · Location · Contrats), `tiers` (Propriétaires · Portail Propriétaire · Locataires · Promoteurs), `finance` (Paiements · Chèques), `exploitation` (Maintenance · Validations · Communication · Inbox · Tickets) et `admin` (Documents · Paramètres). Migration de merge `0026_merge_0025` réconcilie le fork `owner_statements` / `reference_composite_unique`.
