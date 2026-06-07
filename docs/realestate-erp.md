# RealEstate ERP — Cadrage & Roadmap (Property Operations UAE)

> **Statut : Phase 0 — Cadrage (sans code).** Intègre le _Property ERP Prompts Pack_
> (Master Architect + 9 modules) dans la plateforme **SGI** existante, sous la
> rubrique **realestate**. Base de code cible : **monorepo SGI** (`apps/api`,
> `apps/web`, `apps/portal`, `apps/mobile`). Priorités validées : **Maintenance**
> puis **Communication temps réel**.
>
> Toute phase est livrée puis **soumise à validation** avant la suivante.

---

## 1. Vision

Transformer SGI (gestion immobilière) en **Property Operations ERP** UAE :
multi-tenant · multi-company · workflow-driven · communication-centric ·
cloud-native · IA-assisted. On **réutilise** le socle SGI (RLS multi-tenant,
PostGIS, RBAC, audit, Celery, Valkey, MinIO, Gemini/Whisper) et on **complète**
les manques fonctionnels.

Les **3 Lois SGI restent des bloquants PR** pour tout nouveau module :
1. `company_id UUID NOT NULL` + index + RLS sur chaque table métier.
2. PostGIS pour le géospatial (jamais de lat/lng flottants).
3. CSS logique RTL only (`ms-/me-/ps-/pe-/start-/end-`).

Conventions reprises : UUID v4, `created_at/updated_at`, **soft delete**
(`deleted_at`), `DECIMAL(15,2)` AED, multilingue `*_ar/_en/_fr`, réponse
`{success,data,meta}`, `async def`, **Celery** pour tout traitement > 500 ms,
structure de module `routers/{module}/{router,schemas,service,models,test_}.py`,
**TDD ≥ 80 %**.

---

## 2. Mapping pack ERP → SGI (analyse d'écart)

| Module ERP | Déjà couvert par SGI | À compléter |
|---|---|---|
| **01 Property Mgmt** | `buildings`, `floors`, `units`, `properties`, `contracts`, `rentals`, PostGIS, occupancy | **inspections**, **check-in/check-out** |
| **02 Communication** | `messages` (direct), WhatsApp templates, `gemini_translate`, Whisper | **chat temps réel (WebSocket)**, conversations/threads, **voice notes**, mentions, résumé IA |
| **03 Workflow** | séquences CRM, Celery beat | **moteur générique** : approbations, SLA, escalade, triggers |
| **04 Maintenance** | `party_technician`, `party_vendor`, `vendor_missions` (state machine) | **tickets**, **devis**, **factures**, **préventif** |
| **05 Owner/Tenant Portals** | `owners`, `tenants`, `client_portal` | **portail owner**, **paiements en ligne**, **e-signature**, renouvellement |
| **06 Finance** | `finance`, `pdc_cheque` (chèques UAE) | dépôts de garantie, commissions, late-payment (partiel) |
| **07 IAM/Sécurité** | RBAC, `audit_logs`, RLS multi-tenant, JWT | **MFA** |
| **08 IA** | Gemini (résumé contrat, scoring, WhatsApp), reminders Celery | génération contrat, summaries d'appels, prédiction maintenance |
| **09 DevOps** | docker-compose, Prometheus/Grafana/Loki, GH Actions, backups | quasi complet (durcissement) |

**Conclusion** : le socle est là. Les manques structurants sont **Maintenance**,
**Communication temps réel**, **Workflow**, **Portail Owner + paiements/e-signature**,
**inspections**, **MFA**. Les deux premiers sont prioritaires (ce cadrage).

---

## 3. Module prioritaire #1 — Maintenance

**Cible** : `units` (et `buildings`), réutilise `party_technician` (interne),
`party_vendor` + `vendor_missions` (externe), `finance` (factures), Celery
(préventif & SLA), Communication (conversation par ticket — module #2).

### 3.1 Modèle de données (nouvelles tables, toutes RLS)

- **`maintenance_tickets`**
  `id, company_id, reference (MNT-YYYY-NNNNNN), unit_id FK units, building_id FK buildings (nullable),`
  `reported_by_user_id, reporter_role (tenant|owner|agent|system),`
  `category (plumbing|electrical|hvac|appliance|structural|cleaning|other),`
  `priority (low|medium|high|urgent), status, title, title_ar/en/fr?, description,`
  `assigned_technician_id FK users (nullable), assigned_vendor_party_id FK clients (nullable),`
  `vendor_mission_id FK vendor_missions (nullable), sla_due_at, resolved_at,`
  `cost_estimate_aed, cost_final_aed DECIMAL(15,2), created_at/updated_at/deleted_at.`
- **`maintenance_quotes`** — `id, company_id, ticket_id, vendor_party_id, amount_aed, currency, valid_until, status (pending|approved|rejected|expired), notes, file_key (MinIO).`
- **`maintenance_invoices`** — `id, company_id, ticket_id, vendor_party_id, amount_aed, status (draft|issued|paid|overdue), due_date, finance_transaction_id FK (lien finance), file_key.`
- **`maintenance_plans`** (préventif) — `id, company_id, unit_id|building_id, category, frequency (cron/interval), next_due_at, last_generated_at, active.`

**Machine à états du ticket :**
```
new → triaged → assigned → in_progress → resolved → closed   (terminal)
                    │            └→ on_hold → in_progress
                    └→ cancelled (terminal, depuis tout état non terminal)
```
Helpers purs (testables sans DB, dans `service.py`) : `is_valid_ticket_transition`,
`compute_sla_due(priority, created_at)`, `is_sla_breached`, `generate_reference`.

### 3.2 APIs (`/api/v1/maintenance`)
- `tickets` CRUD paginé (filtres `status, priority, category, unit_id, assignee`).
- Actions : `POST /tickets/{id}/assign` (technicien **ou** vendor → crée une `vendor_mission`),
  `POST /tickets/{id}/status`, `POST /tickets/{id}/quotes`, `POST /quotes/{id}/{approve,reject}`,
  `POST /tickets/{id}/invoices`, `POST /tickets/{id}/close`.
- `plans` CRUD ; `GET /maintenance/calendar?horizon_days=` (SLA + préventif à venir).
- Réutilise le portail : tenant crée un ticket via `client_portal` (« demande de maintenance »).

### 3.3 Automatisations (Celery — queue `reminders`/`notifications`)
- **Préventif** : beat scanne `maintenance_plans.next_due_at` → génère les tickets.
- **SLA** : alerte J-… et escalade manager si `is_sla_breached` (préfigure le Workflow engine #3).
- **Notifications** : assignation, changement de statut, devis à approuver.

### 3.4 UI (apps/web back-office + apps/portal tenant)
- Back-office : liste tickets (kanban par statut), détail, assignation, devis/facture.
- Portail tenant : créer une demande, suivre l'avancement (réutilise le pattern « Mes leads »).
- RTL-safe, i18n AR/EN/FR.

---

## 4. Module prioritaire #2 — Communication temps réel

**Cible** : faire évoluer `messages` (direct, non temps réel) vers un moteur de
**conversations** temps réel. Réutilise **Valkey** (pub/sub multi-réplicas, l'API
scale via `make scale`), **MinIO** (`storage.py`) pour les voice notes, **Whisper**
(transcription) et **Gemini** (résumé/traduction).

### 4.1 Modèle de données (RLS)
- **`conversations`** — `id, company_id, type (direct|group|ticket|contract), subject,`
  `maintenance_ticket_id FK (nullable), contract_id FK (nullable), created_by, last_message_at, created_at/updated_at/deleted_at.`
- **`conversation_participants`** — `id, company_id, conversation_id, user_id, role, last_read_at, muted.`
- **`conversation_messages`** — `id, company_id, conversation_id, sender_user_id, body, kind (text|voice|system),`
  `attachment_key (MinIO), transcript, transcript_lang, reply_to_id, created_at, edited_at, deleted_at.`
- **`message_mentions`** — `id, company_id, message_id, mentioned_user_id.`

> **Migration** : la table `messages` existante est conservée ; on fournit un
> backfill optionnel `messages → conversations(type=direct)`. Pas de DELETE.

### 4.2 Temps réel (WebSocket)
- Endpoint `WS /api/v1/ws/conversations` (auth JWT via query/cookie ; `company_id` du token).
- **Fan-out multi-réplicas via Valkey pub/sub** : channel `conv:{company_id}:{conversation_id}`.
  Chaque réplica API s'abonne et pousse aux WS locaux → cohérent avec `make scale n=`.
- Événements : `message.created`, `message.read`, `typing`, `mention`.
- Présence/typing : clés Valkey TTL (jamais sans TTL — anti-pattern SGI).

### 4.3 Voice notes & IA (Celery)
- Upload audio → MinIO (`storage.py`) ; tâche Celery → **Whisper** transcription → `transcript`.
- **Résumé de conversation** à la demande (`gemini`), **traduction** inline (`gemini_translate`).
- Notifications mentions/nouveaux messages (queue `notifications`).

### 4.4 UI
- Back-office + portail : panneau conversations temps réel, threads par ticket/contrat,
  enregistrement vocal, indicateurs lu/non-lu, mentions. RTL-safe, i18n AR/EN/FR.

---

## 5. Sécurité & qualité (transverse, chaque phase)
- RLS + policy `tenant_isolation` + index `company_id` sur **chaque** nouvelle table (migration).
- Permissions par rôle (`require_roles`) ; tenant ne voit que ses tickets/conversations.
- WebSocket : vérif `company_id` à la connexion **et** à chaque souscription de channel.
- Voice notes : validation MIME/taille (déjà fait côté Whisper), scan clé MinIO scoping tenant.
- TDD : helpers purs + tests d'intégration multi-tenant (isolation), couverture ≥ 80 %.
- Audit : actions sensibles (assignation, approbation devis) loguées via `AuditMiddleware`.

---

## 6. Plan par phases (chaque fin de phase → **validation**)

| Phase | Contenu | Livrables | Gate |
|---|---|---|---|
| **0 — Cadrage** _(en cours)_ | Ce document + plan | `docs/realestate-erp.md` | **Ta validation** |
| **1 — Maintenance (cœur)** | Tables `maintenance_tickets` (+ migration RLS), state machine, CRUD + assignation (technicien/vendor→`vendor_mission`), SLA helpers, tests | router `maintenance`, migration `00xx`, tests | Validation |
| **2 — Maintenance (devis/préventif/UI)** | `quotes`/`invoices` + lien `finance`, `maintenance_plans` + beat préventif, kanban back-office, demande portail tenant | UI web + portail, Celery, tests | Validation |
| **3 — Communication (données + REST)** | `conversations`/`participants`/`messages`/`mentions` (+ migration & backfill `messages`), REST CRUD, tests isolation | router `comms`, migration, tests | Validation |
| **4 — Communication (temps réel + IA)** | WebSocket + Valkey pub/sub, voice notes MinIO, transcription/résumé/traduction, notifications, UI temps réel | WS, Celery, UI, tests | Validation |
| **Backlog (hors priorité)** | Workflow engine · Portail Owner + paiements + e-signature · inspections/check-in-out · MFA · IA (génération contrat, prédiction) | à planifier | — |

**Principe de livraison par phase** : red→green→refactor→tests→(déploiement local
via volumes montés)→ vérif end-to-end → audit rapide (RLS/i18n/perf) → **validation**.

---

## 7. Décisions ouvertes (à trancher avant Phase 1)
1. **Maintenance externe** : un ticket assigné à un vendor crée-t-il **toujours** une
   `vendor_mission`, ou seulement à l'acceptation du devis ?
2. **SLA** : barème par priorité (ex. urgent = 4 h, high = 24 h, medium = 72 h, low = 7 j) — à confirmer.
3. **Communication** : on **fait évoluer** `messages` vers `conversations` (recommandé) ou on garde les deux en parallèle ?
4. **Voice notes** : provider de transcription par défaut (Whisper OpenAI vs Gemini audio) — dépend des clés dispo.
5. **Périmètre UI Phase 1** : back-office seul d'abord, ou back-office + portail tenant en même temps ?
