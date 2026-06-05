# Module `admin` — Administration application

Console d'administration à **deux périmètres de sécurité étanches**. Ne jamais mélanger
les deux gardes ni les deux jeux de tables.

## Les deux périmètres

| Périmètre | Préfixe | Garde (au niveau routeur) | Données | Loi 1 |
|---|---|---|---|---|
| **App-admin** (tenant) | `/api/v1/admin/{users,audit,alerts}` | `require_admin` (admin\|manager) ; écritures sensibles → `require_admin_write` (admin) | `admin_alert_rules`, `admin_alert_events` (company_id + RLS) | ✅ scopé tenant |
| **Infra-admin** (plateforme) | `/api/v1/admin/platform/*` | `require_platform_admin` (lit `users.is_platform_admin` en DB) | `infra_services`, `infra_actions`, `backup_runs`, `infra_remediation_rules` (**PAS** de company_id) | ❌ exception documentée (cross-tenant) |

- Les gardes sont posées **au niveau du routeur** (`dependencies=[Depends(...)]`), jamais
  par-route → aucune route ne peut être accidentellement nue.
- `require_admin`/`require_admin_write` ([deps.py](deps.py)) distinguent **401** (non
  authentifié) de **403** (rôle insuffisant) — on NE réutilise PAS `core.deps.require_role`
  (rôle seul → 403 même anonyme), partagé par ~43 routers.
- `require_platform_admin` ([app/core/deps.py](../../core/deps.py)) n'utilise PAS
  `get_db_session` (périmètre volontairement cross-tenant) → `get_db` simple.
- `is_platform_admin` est lu **en DB à chaque requête** (pas dans le JWT) → l'octroi/retrait
  prend effet sans relogin.

## Sécurité critique — tout est inerte par défaut

Toutes les opérations qui touchent l'infra réelle sont **gardées par un flag d'env, défaut
`false` → dry-run** (intention journalisée, aucune action). Voir le runbook d'activation
prod dans [DEPLOYMENT.md](../../../../../DEPLOYMENT.md).

| Flag (défaut `false`) | Active | Routeur / tâche | Prérequis |
|---|---|---|---|
| `INFRA_CONTROL_ENABLED` | actions serveur réelles (restart/stop/start/suspend) | `infra.py` → `infra_control.execute_infra_action` | profil compose `control` (worker-infra + docker-socket-proxy) |
| `BACKUP_TRIGGER_ENABLED` | `pg_dump` réel | `backups.py` → `backups.run_backup` | `pg_dump` dans l'image worker, `BACKUP_DIR` |
| `RESTORE_ENABLED` | `pg_restore` réel | `backups.py` → `backups.execute_restore` | `pg_restore`/`psql` worker, `RESTORE_TARGET_DB` |
| `AUTO_REMEDIATION_ENABLED` | beat alerte Prometheus → action D2 | `infra_control.auto_remediate` | Prometheus + `INFRA_CONTROL_ENABLED` |

## Pièges & invariants

- **Restauration = base CIBLE jetable, JAMAIS la live.** `execute_restore` recrée
  `RESTORE_TARGET_DB` (défaut `<POSTGRES_DB>_restore_check`) et y rejoue le dump. Le worker
  refuse (`_restore_guard`) si le flag est off, si la cible == base live
  (`refuse_overwrite_live_db`), ou si le nom de cible est invalide. La promotion vers la
  base live reste un acte ops **manuel** (hors scope). Un run de restauration est tracé dans
  `backup_runs` avec `kind='restore'` (CHECK étendu par la migration 0056).
- **docker-socket-proxy** n'autorise que la section API `CONTAINERS` + `POST` (tout le reste
  refusé) ; la whitelist d'actions (`restart/stop/start/pause`, `suspend`→`pause`) est
  ré-imposée **en code** (`op_for_action`). `api`/`db`/`valkey`/`minio` sont
  **délibérément exclus** de `is_controllable` (auto-destruction).
- **Tendance** (`/platform/trend`) et **serveurs/réseau** dégradent proprement si Prometheus
  est injoignable (`available:false`/`prometheus_available:false`, jamais de 500). Déployer
  la stack via `make monitoring` pour des données réelles.
- Registre `infra_services` peuplé par [scripts/seed_infra_services.py](../../../scripts/seed_infra_services.py)
  (`name` == job Prometheus ; `compose_service` == label docker-compose).
- Tables plateforme sans company_id → **ne jamais** les exposer sans `require_platform_admin`,
  **jamais** via le middleware tenant.

## Migrations

`0048_admin_console` (socle + `is_platform_admin` + tables) · `0051_infra_compose_service`
(colonne `compose_service`) · `0053_infra_remediation_rules` (auto-rem) · `0056_backup_runs_kind_restore`
(autorise `kind='restore'`).
