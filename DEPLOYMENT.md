# DEPLOYMENT — Activation de la RLS multi-tenant en production

Ce runbook décrit **l'unique étape de sécurité à ne pas oublier** lors d'un
déploiement : activer réellement la **Row Level Security** PostgreSQL en faisant
passer l'API par le rôle applicatif restreint **`sgi_app`**.

> ⚠️ **Sans cette étape, l'isolation multi-tenant (Loi 1) est inerte en prod.**
> Si `APP_DB_PASSWORD` n'est pas défini, l'API retombe sur le rôle privilégié
> `sgi_user` (SUPERUSER, propriétaire des tables) qui **bypasse inconditionnellement
> la RLS** — l'isolation ne tient alors que par le filtrage applicatif `company_id`,
> et un seul oubli de filtre = fuite cross-tenant (BOLA).

## Contexte (audit C1)

| Rôle | Privilèges | Utilisé par |
|---|---|---|
| **`sgi_app`** | `LOGIN`, **`NOSUPERUSER`**, **`NOBYPASSRLS`**, non-propriétaire (CRUD only) | **Requêtes API** (`APP_DATABASE_URL`) |
| `sgi_user` | privilégié (propriétaire) | **Worker Celery** + **migrations Alembic** (les tâches cron scannent légitimement toutes les sociétés) |

La migration **`0023_app_role_rls`** crée `sgi_app` de façon **idempotente** et
**opt-in** : elle n'agit que si `APP_DB_PASSWORD` est présent dans l'environnement
au moment de `alembic upgrade` (sinon no-op, pour ne pas casser dev/CI).

L'API choisit sa connexion via `Settings.APP_DATABASE_URL`
([apps/api/app/core/config.py](apps/api/app/core/config.py)) :
- `APP_DB_PASSWORD` **défini** → `postgresql+asyncpg://sgi_app:<pwd>@db/…` → **RLS active**
- `APP_DB_PASSWORD` **vide** → repli sur `DATABASE_URL` (`sgi_user`) → **RLS inerte**

Le contexte tenant est posé par requête via `SET app.current_company_id`
(middleware + `get_db_session`), lu par les policies
`tenant_isolation USING (company_id = current_setting('app.current_company_id')::uuid)`.

## Variables d'environnement requises

```bash
# Rôle PRIVILÉGIÉ — worker, migrations, propriétaire des tables
DATABASE_URL=postgresql+asyncpg://sgi_user:<USER_PWD>@db:5432/sgi

# Rôle RESTREINT — connexion de l'API (active la RLS)
APP_DB_USER=sgi_app
APP_DB_PASSWORD=<SECRET_FORT_DEDIE>     # ⚠️ secret réel en prod (≠ celui de sgi_user)
```

Générer un mot de passe fort :

```bash
openssl rand -base64 32
```

Stocker `APP_DB_PASSWORD` dans le **gestionnaire de secrets** (jamais commité ;
`.env` est gitignoré). Le mot de passe doit être **identique** entre la migration
(qui pose le mot de passe du rôle) et `APP_DATABASE_URL` (qui s'y connecte).

## Procédure de déploiement

1. **Définir le secret** dans l'environnement de déploiement (CI/CD ou orchestrateur) :
   ```bash
   export APP_DB_PASSWORD='…'   # le même qui sera injecté dans le conteneur api
   ```

2. **Appliquer les migrations** (rôle privilégié `sgi_user`), **avec `APP_DB_PASSWORD` exporté**
   afin que `0023_app_role_rls` crée/repositionne le rôle `sgi_app` :
   ```bash
   docker compose run --rm -e APP_DB_PASSWORD="$APP_DB_PASSWORD" api \
     uv run alembic upgrade head
   ```
   La sortie ne doit **pas** afficher « APP_DB_PASSWORD non défini — rôle applicatif
   restreint NON créé ».

3. **Recréer le conteneur API** pour qu'il charge `APP_DB_PASSWORD` et se connecte
   désormais en `sgi_app` :
   ```bash
   docker compose up -d --force-recreate api
   ```
   > Ordre important : créer le rôle (étape 2) **avant** de basculer la connexion
   > (étape 3), sinon courte fenêtre où l'API viserait un rôle inexistant.

4. **Vérifier** (voir ci-dessous) puis ouvrir le trafic.

## Vérification post-déploiement

### a) Le rôle existe et est bien restreint

```bash
docker compose exec db psql -U sgi_user -d sgi -c \
  "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
     FROM pg_roles WHERE rolname='sgi_app';"
```
Attendu : `rolsuper = f`, `rolbypassrls = f`, `rolcanlogin = t`.

### b) L'API se connecte bien en `sgi_app`

```bash
docker compose exec db psql -U sgi_user -d sgi -c \
  "SELECT usename, count(*) FROM pg_stat_activity
     WHERE datname='sgi' GROUP BY usename;"
```
Attendu : des connexions `sgi_app` (API) **et** `sgi_user` (worker/beat).

### c) L'isolation s'applique réellement (test cross-tenant)

```sql
-- En tant que sgi_app (rôle restreint) :
SET ROLE sgi_app;                       -- ou se connecter directement en sgi_app
SET app.current_company_id = '<COMPANY_A_UUID>';
SELECT count(*) FROM properties;        -- ne compte QUE les biens de A
SET app.current_company_id = '<COMPANY_B_UUID>';
SELECT count(*) FROM properties;        -- ne compte QUE les biens de B
RESET ROLE;
```
Si les deux comptes sont identiques / incluent toutes les sociétés → **la RLS est
inerte** (vous êtes probablement encore en `sgi_user`). Reprendre étapes 1–3.

Le test d'intégration automatisé correspondant :
[apps/api/app/core/test_rls_isolation.py](apps/api/app/core/test_rls_isolation.py)
(skippé si `APP_DB_PASSWORD` absent).

## Garde-fous recommandés

- **CI/CD** : refuser un déploiement prod si `APP_DB_PASSWORD` est vide
  (le repli silencieux sur `sgi_user` est la principale source d'erreur).
  ```bash
  : "${APP_DB_PASSWORD:?APP_DB_PASSWORD requis en production (RLS)}"
  ```
- **Supervision** : alerter si des connexions à la base `sgi` apparaissent sous
  `sgi_user` en provenance des conteneurs **api** (elles devraient être en `sgi_app`).
- Ne **jamais** committer `APP_DB_PASSWORD` (`.env` est gitignoré ; utiliser un
  secret manager).

## Rollback

La création du rôle est idempotente et sans risque. Pour revenir temporairement
au comportement historique (RLS inerte) : retirer `APP_DB_PASSWORD` de
l'environnement de l'API et recréer le conteneur — l'API repasse en `sgi_user`.
Le rôle `sgi_app` peut rester en place (inoffensif).

---

# Activation du module « Administration application » (infra-admin)

Le module `admin` (réf. [apps/api/app/routers/admin/CLAUDE.md](apps/api/app/routers/admin/CLAUDE.md))
est **livré inerte** : sans les étapes ci-dessous, l'app-admin (users/audit/alertes) fonctionne,
mais l'infra-admin (serveurs/réseau/backups) est en **lecture seule / dry-run** — aucune action
réelle. On active par paliers, du moins au plus sensible. **Chaque flag est `false` par défaut.**

## 0. Pré-requis transverses

1. **Super-admin plateforme** — au moins un utilisateur avec `is_platform_admin=true` (lu en DB
   à chaque requête, pas dans le JWT) :
   ```sql
   UPDATE users SET is_platform_admin = true WHERE email = 'ops@infinity.ae';
   ```
2. **Migrations à jour** : `make migrate` (head ≥ `0056_backup_runs_kind_restore`).

## 1. Observabilité (lecture — non destructif)

Sans Prometheus, les écrans Serveurs/Réseau/Tendance dégradent proprement (`available:false`,
jamais de 500). Pour des données réelles :

```bash
make monitoring                 # Prometheus :9090 / Grafana :3002 (docker-compose.monitoring.yml)
export PROMETHEUS_URL=http://prometheus:9090
docker compose exec -e PYTHONPATH=/app api uv run python scripts/seed_infra_services.py
```
`seed_infra_services` peuple le registre `infra_services` (le `name` doit == le `job` Prometheus).

## 2. Sauvegardes — déclenchement (`BACKUP_TRIGGER_ENABLED`)

Non destructif (créer un dump ne touche pas aux données). Requiert `pg_dump` (postgresql-client)
dans l'image worker.
```bash
BACKUP_TRIGGER_ENABLED=true
BACKUP_DIR=/backups            # volume persistant monté sur le worker
```
Flag off → l'endpoint reste en dry-run. Double confirmation = nom de la cible (`db`).

## 3. Contrôle serveurs réel (`INFRA_CONTROL_ENABLED` + profil `control`)

**Double verrou** : le flag ET le profil compose. Démarrer le worker dédié + le proxy Docker
durci (seule la section API `CONTAINERS`+`POST` est autorisée ; `api`/`db`/`valkey`/`minio`
sont exclus de `is_controllable` en dur) :
```bash
INFRA_CONTROL_ENABLED=true
docker compose --profile control up -d   # démarre worker-infra + docker-socket-proxy
```
Flag off OU profil non démarré → les actions restent en dry-run. Whitelist : restart/stop/start/
suspend (suspend→pause). Double confirmation = nom du service.

## 4. Auto-remédiation (`AUTO_REMEDIATION_ENABLED`)

Boucle préventive : le beat `auto_remediate` (toutes les 2 min) mappe une alerte Prometheus
*firing* → action D2. **Requiert l'étape 1 (Prometheus) ET l'étape 3 (contrôle réel)**.
```bash
AUTO_REMEDIATION_ENABLED=true
```
Anti-rebond : pas de 2ᵉ action sur un service déjà actionné < 10 min. Reste 100 % plateforme
(ne franchit jamais un tenant). Flag off → les règles sont évaluées en dry-run.

## 5. Restauration de backup (`RESTORE_ENABLED`) — la plus sensible

Restaure un dump **dans une base CIBLE jetable** (`RESTORE_TARGET_DB`, défaut
`<POSTGRES_DB>_restore_check`) — **JAMAIS la base de production** : sert à *vérifier qu'un dump
est restaurable*. Le worker refuse si la cible == base live. Requiert `pg_restore`/`psql` worker.
```bash
RESTORE_ENABLED=true
RESTORE_TARGET_DB=sgi_restore_check     # doit être ≠ POSTGRES_DB
```
Flag off → dry-run (intention journalisée, aucune base touchée). Double confirmation = token
littéral `restore`. **La promotion de la base de vérification vers la prod reste un acte ops
manuel et hors scope** — ne jamais automatiser sans revue.

## Ordre d'activation conseillé & rollback

1 (observabilité) → 2 (backups) → 3 (contrôle) → 4 (auto-rem) → 5 (restauration). **Rollback** :
repasser n'importe quel flag à `false` (effet immédiat, retour au dry-run) ; pour couper le
contrôle réel, `docker compose --profile control down` suffit même flag laissé à `true`.

---

# SSO OAuth (Google · Apple)

Optionnel et **opt-in** : tant que les credentials ne sont pas renseignés, les boutons de login
répondent « non configuré » (aucune régression). Connexion *match-only* (uniquement des comptes
internes existants, match par **email vérifié** — pas d'auto-création). Runbook complet (Google
Cloud Console / Apple Developer, URIs de callback, où placer `client_id` vs `client_secret`) :
**[docs/setup-sso.md](docs/setup-sso.md)**.

Câblage : le service `api` lit tous les credentials via `env_file: .env` ; `docker-compose.yml`
propage les `*_OAUTH_CLIENT_ID` au service `web` (le BFF en a besoin pour l'URL d'autorisation, le
**secret reste côté API**). Il suffit donc de renseigner les variables dans `.env` (cf. `.env.example`).
