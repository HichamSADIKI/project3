# Studio de Modules + Superviseur de sécurité (architecture)

> **Périmètre PLATEFORME** (super-admin, `require_platform_admin`, HORS Loi 1 — tables sans
> `company_id`, comme `infra_*`). Permet de **concevoir, générer, gouverner, utiliser et
> superviser** de nouveaux modules applicatifs depuis l'app. Migrations **0066** (`studio_modules`,
> `studio_integration_requests`) et **0067** (`studio_orchestrator_jobs`).

## La chaîne complète

```
Concevoir → Gouverner → Générer (code) → Utiliser → Superviser
 (lite)      (4-eyes)     (worker-studio)  (générique)  (dashboard)
```

1. **Concevoir** — un module porte un `SheetSchema` (feuilles → éléments → actions/fonctions),
   construit en **manuel** (builder visuel), **JSON brut**, ou **IA** (Gemini). Les 3 voies
   produisent le même schéma. `flavor` ∈ {`lite`, `code`}.
2. **Gouverner** — l'intégration passe par une **approbation à 2 yeux (4-eyes)** : un admin demande
   (raison + ticket + TTL), un admin **distinct** approuve. Tracé `audit_logs`. *(Remplace le
   « mot de passe en dur » — refus doctrine.)*
3. **Générer** (flavor `code`) — un **worker dédié isolé** compile le `SheetSchema` en **vrai
   module CRUD** (table + RLS Loi 1 + migration + router + service + schemas + test Red-Team
   cross-tenant) sur une **branche git**, fait RADAR (ruff) + CHASSEUR, puis **ouvre une PR**.
   **Jamais d'auto-merge** — merge = gate humaine « GO #PR ».
4. **Utiliser** — un **écran générique data-driven** « Modules (données) » sert **tous** les modules
   générés : lit leur schéma → liste + création + suppression, via un proxy générique. Le module
   généré applique sa **propre Loi 1** (`company_id`+RLS) + `require_roles`.
5. **Superviser** — un **dashboard sécurité global** read-only agrège les événements sécu
   cross-tenant (via `audit_logs`) + la gouvernance Studio.

## Backend (`apps/api/app/routers/admin/`)

| Fichier | Rôle |
|---|---|
| `studio.py` | Sous-routeur `/platform/studio` : CRUD modules, `build` (dry-run lite ou délégation code), `schema` (POST/GET), `generate-schema` (IA), flux 4-eyes (`request-/approve-integration`), `jobs`. Machine à états `draft→built→tested→audited→pr_open→approved→integrated` (+ `rejected`/`failed`). |
| `studio_schema.py` | `SheetSchema` strict (Pydantic, `extra=forbid`, actions bouton liste blanche). **Donnée, jamais exécutée.** |
| `studio_ai.py` | Génération IA d'un `SheetSchema` via `app.core.gemini.generate_text` ; sortie **toujours revalidée** ; `fallback_schema` déterministe. |
| `studio_templates.py` | Gabarits **purs déterministes** : `column_specs` (type d'élément → colonne, réservés→`f_`, CHECK des select), `compute_revision`, renderers CRUD (calqués sur `developers`). Squelette (3A) si pas de schéma. |
| `security.py` | Sous-routeur `/platform/security` : `GET /overview` (buckets d'événements `audit_logs` 24h/7j + récents + gouvernance Studio). Helpers purs `prefix_of`/`aggregate_by_prefix`. |
| `app/models/studio.py` | `StudioModule`, `StudioIntegrationRequest` (4-eyes, CHECK `approved_by<>requested_by`), `StudioOrchestratorJob`. |
| `app/tasks/studio_orchestrator.py` | **Worker codegen** (queue `studio`). Voir ci-dessous. |

Tous montés dans `admin/router.py` (périmètre B). Le superviseur lit `audit_logs` (sans RLS) en
**cross-tenant** via `get_db`.

## Le worker `worker-studio` (la pièce sensible)

`app/tasks/studio_orchestrator.py` + service compose `worker-studio` (`Dockerfile.studio` =
image API + `git` + `gh`). Doctrine **fail-secure** calquée sur `infra_control` :

- **Profil compose `["studio"]` → éteint par défaut** + **double verrou** `STUDIO_CODEGEN_ENABLED`.
  L'API n'exécute jamais : elle insère un `studio_orchestrator_jobs` (`requested`) et enqueue
  `run_codegen_job(job_id)`.
- **Whitelist d'argv stricte** (`_check_allowed`, `shell=False`) : seulement `git
  worktree|clone|fetch|checkout|add|commit|push`, `gh pr create`, `uv run ruff`. **Jamais**
  `merge`/`--force`/`--hard`/`rm`/shell libre.
- **Clone isolé** dans un volume (`studio_worktrees`), jamais le checkout hôte. Worktree jeté par job
  (+ reaper beat). **Token GH rédigé** des logs.
- Pipeline : `scaffold` (clone/worktree/branche/écriture + pré-check collision) → `radar`
  (`ruff check --fix` + `format` + vérif) → `chasseur` (présence du test) → `push` + `gh pr create`.
- RADAR/CHASSEUR **découpés** : le worker fait le RADAR statique (ruff) ; le **pytest du module
  généré (test Red-Team cross-tenant Loi 1) s'exécute dans la CI de la PR** avant tout merge humain.

### Variables d'environnement (worker)
| Var | Défaut | Rôle |
|---|---|---|
| `STUDIO_CODEGEN_ENABLED` | `false` | Active la génération réelle (sinon `build` reste dry-run/501). |
| `STUDIO_GH_TOKEN` | — | Token GitHub **fine-grained** `contents+pull_requests:write` (**jamais merge**), Vault en prod. |
| `STUDIO_REPO_URL` | — | URL HTTPS du dépôt (sans token). |
| `STUDIO_WORKTREE_BASE` / `STUDIO_REPO_DIR` | `/worktrees` | Sandbox du clone + worktrees. |
| `STUDIO_INTEGRATION_TTL_MINUTES` | `60` | Fenêtre de validité des demandes 4-eyes. |

### Activer la génération réelle (manuel)
```bash
STUDIO_CODEGEN_ENABLED=true STUDIO_GH_TOKEN=… STUDIO_REPO_URL=https://github.com/Org/repo.git \
  docker compose --profile studio up -d worker-studio
```

## Frontend (`apps/web/`)

| Fichier | Rôle |
|---|---|
| `app/screens/studio.tsx` | Écran Studio : liste/création modules, build, 4-eyes, éditeur schéma (Visuel/JSON + ✨ IA + aperçu), UI des jobs. Nav `appadmin_studio`. |
| `components/studio-builder.tsx` | Builder visuel (arbre feuilles→éléments→actions). |
| `components/studio-renderer.tsx` | Moteur de rendu d'un `SheetSchema` (display-only, zéro eval). |
| `lib/studio-schema.ts` | Types + helpers purs (`normalizeSchema`…). |
| `app/screens/crud-gen.tsx` + `components/studio-crud-form.tsx` + `lib/studio-crud.ts` | Écran **générique** des modules générés (nav `appadmin_crudgen`). `fieldColumns` **porte la logique `column_specs`** du backend. |
| `app/api/studio-gen/[slug]/[[...path]]/route.ts` | Proxy générique vers le CRUD d'un module généré (relaie le Bearer ; **aucune élévation** ; `slug` borné). |
| `app/screens/admin-security.tsx` | Dashboard superviseur sécu (nav `appadmin_security`). |

## Sécurité (récap)
- **3 invariants** respectés : identité (`require_platform_admin`), isolation (modules générés =
  Loi 1 ; tables Studio = exemption plateforme documentée), audit (`audit_logs` aux points 4-eyes).
- **Jamais d'auto-merge** · **aucun secret en dur** · **worker isolé + dry-run par défaut + whitelist
  d'argv** · sortie IA revalidée · CHECK des select charset-sûr only · proxy générique = token user
  (pas d'élévation).

## Tests
- Backend co-localisés : `test_studio.py`, `test_studio_orchestrator.py`, `test_studio_templates.py`,
  `test_security.py` (helpers purs + gardes 401/403 + pipeline monkeypatché + agrégation). Lancés en
  base PG **isolée jetable** (jamais la base dev).
- Frontend : vitest (`studio-schema.test.ts`, `studio-crud.test.ts`), tsc, eslint.
- **Garantie Loi 1 du code généré** = le test Red-Team cross-tenant **généré**, exécuté par la CI de
  chaque PR de module.

## Roadmap (livré vs restant)
**Livré** (PR #283→#297) : 0 gouvernance · 1/1B lite+IA · 2 builder · 3A orchestrateur · 3B CRUD ·
3B+ A/B (UI jobs, CHECK, collision) · 3B+ C écran générique · 4 superviseur.
**Restant** : édition PATCH (écran générique) · nœud IAM catalogue pour modules générés · presence
live par société (superviseur) · graphes temporels · codegen LLM (déconseillé).
