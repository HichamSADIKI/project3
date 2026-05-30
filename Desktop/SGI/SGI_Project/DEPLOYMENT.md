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
