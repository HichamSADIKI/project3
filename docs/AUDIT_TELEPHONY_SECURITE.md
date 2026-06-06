# Audit de sécurité — Module Téléphonie (Phase 2)

Périmètre : `apps/api/app/routers/telephony/` (router, service, ws, ami, models,
schemas), migration `0028_telephony.py`, configuration `infra/asterisk/`.
Référentiels : Loi 1 (multi-tenant / RLS), anti-BOLA, RBAC, PDPL (UAE Personal
Data Protection Law — enregistrements d'appels).

Date : 2026-06-01 · Auteur : agent Tests & Audit sécurité.

---

## Synthèse

| Sévérité | # | Domaine |
|---|---|---|
| Critique | 1 | Démarrage / wiring (API down) |
| Élevée | 2 | PDPL (fuite recording_url), RBAC lecture |
| Moyenne | 3 | RLS contexte WS, BOLA filtre agent, AMI prod |
| Faible | 2 | Durcissement AMI, logs |

Le cœur multi-tenant (Loi 1) est **correctement implémenté** : toutes les
fonctions DB de `service.py` filtrent par `company_id`, la migration pose RLS +
index sur `calls` et `agent_states`, le WS namespace le channel Valkey par
`company_id` ET par extension, et l'appartenance de l'extension est vérifiée par
tenant avant d'accepter le socket. Les failles ci-dessous concernent surtout la
PDPL, le RBAC des endpoints de lecture, et un point critique de wiring.

---

## CRITIQUE

### C-1 — `telephony/__init__.py` n'exporte pas `router` → API entière en crash

- Fichier : `apps/api/app/routers/telephony/__init__.py`
- `apps/api/app/main.py:169` fait `app.include_router(telephony.router, …)` mais
  `__init__.py` ne contient qu'une docstring : aucun attribut `router`.
- Effet : `AttributeError: module 'app.routers.telephony' has no attribute 'router'`
  au chargement de `app.main` → **l'API ne démarre pas du tout**, et **toute la
  suite pytest est incollectable** (conftest importe `app.main`). Vérifié en
  conteneur (`api` Exited(1), pytest `--collect-only` échoue sur conftest).
- Comparaison : tous les autres modules exposent le router, ex.
  `app/routers/comms/__init__.py` : `from app.routers.comms.router import router`.
- Recommandation (architecte) : ajouter dans `__init__.py`
  `from app.routers.telephony.router import router` + `__all__ = ["router"]`
  (ou importer le sous-module router directement dans `main.py`). Bloquant.

---

## ÉLEVÉE

### H-1 — PDPL : `recording_url` exposé sans vérifier `recording_consent`

- Fichiers : `apps/api/app/routers/telephony/schemas.py:52` (`recording_url` dans
  `CallOut`) ; `apps/api/app/routers/telephony/router.py:128-138` (GET /calls/{id})
  et `:77-95` (GET /calls) sérialisent `CallOut.model_validate(call)` tel quel.
- Problème : dès qu'un enregistrement est attaché (`recording_url` non nul,
  prévu Phase 4), l'URL est renvoyée dans la réponse **même si
  `recording_consent` est `false`**. Sous PDPL UAE, l'enregistrement vocal est
  une donnée personnelle qui nécessite une base légale/consentement ; exposer le
  lien (et a fortiori permettre son téléchargement) sans consentement est une
  violation.
- Constat complémentaire : il n'existe **aucun endpoint de download**
  d'enregistrement aujourd'hui (seules les colonnes `recording_url` /
  `recording_consent` existent). La faille est donc, à ce stade, la *divulgation
  de l'URL* dans le CDR. Elle deviendra critique dès qu'un endpoint de
  téléchargement sera ajouté.
- Recommandation :
  1. Masquer `recording_url` (→ `None`) dans la sérialisation quand
     `recording_consent is False` (au niveau du router ou via un validateur
     `CallOut`).
  2. Lorsque l'endpoint de download sera créé (Phase 4), refuser (403) si
     `recording_consent is False`, et journaliser l'accès (audit PDPL).
- Test : `test_recording_url_exposed_without_consent` (xfail tant que non
  corrigé ; passera à vert une fois l'URL masquée).

### H-2 — RBAC : les endpoints de LECTURE n'ont aucun garde de rôle

- Fichier : `apps/api/app/routers/telephony/router.py`
  - `GET /calls` (`:77`), `GET /calls/{id}` (`:128`), `GET /agents` (`:222`),
    `GET /lookup` (`:270`) : **aucun** `dependencies=[Depends(_require_roles(...))]`.
- Effet : tout utilisateur porteur d'un JWT valide du tenant — y compris un rôle
  non opérationnel (`client`, `fournisseur`, portails) si un tel token atteint
  ce router — peut lister l'intégralité du journal d'appels du tenant, voir la
  présence de tous les agents, et surtout **utiliser `/lookup` comme oracle de
  numéros de téléphone** (énumération : tester un numéro → savoir s'il est
  client). La création/transition/click-to-call sont, elles, bien gardées
  (`admin/manager/agent`).
- Impact tenant : pas de fuite *cross-tenant* (le filtre `company_id` tient,
  voir tests d'isolation), mais fuite *intra-tenant* vers des rôles qui ne
  devraient pas voir la téléphonie.
- Recommandation : ajouter `_require_roles("admin", "manager", "agent")` (ou un
  rôle `supervisor` dédié) sur les 4 GET. Le screen pop `/lookup` en particulier
  doit être réservé aux rôles opérationnels.

---

## MOYENNE

### M-1 — Contexte RLS du WS posé en `is_local=true` hors transaction explicite

- Fichier : `apps/api/app/routers/telephony/router.py:327-331`
  ```py
  await db.execute(
      sql_text("SELECT set_config('app.current_company_id', :cid, true)"),
      {"cid": str(company_uuid)},
  )
  state = await get_agent_state(db, company_uuid, user_uuid)
  ```
- `set_config(..., true)` = portée **transaction**. Le WS utilise `Depends(get_db)`
  (et non `get_db_session` qui épingle/scope la session). Selon le mode de
  commit/autocommit de la connexion, le GUC peut être réinitialisé avant la
  requête `get_agent_state`, vidant le contexte RLS. En prod, sous le rôle
  restreint `sgi_app`, cela ferait échouer (ou pire, laisser passer) la lecture
  de `agent_states` de façon non déterministe.
- Atténuation actuelle : la requête `get_agent_state` filtre **explicitement**
  par `company_id` en SQL, donc même si RLS retombe, l'isolation logique tient.
  Mais on ne doit pas dépendre uniquement de ça (défense en profondeur).
- Recommandation : poser le GUC en `is_local=false` (portée session) comme le
  fait `get_db_session`, OU encadrer la vérification dans un `async with
  db.begin():`. Aligner sur le pattern documenté (CLAUDE.md, Law 1 : « GUC tenant
  épinglé sur la connexion »).

### M-2 — BOLA : filtre `agent_user_id` non borné au demandeur

- Fichiers : `router.py:77-95` + `service.py:200-229` (`list_calls`, paramètre
  `agent_user_id`).
- Un agent peut filtrer `GET /calls?agent_user_id=<UUID d'un autre agent>` et
  lire les appels d'un collègue. Reste **intra-tenant** (le filtre `company_id`
  empêche toute fuite cross-tenant — vérifié par
  `test_list_calls_agent_filter_no_cross_tenant_leak`), donc sévérité moyenne,
  mais c'est un BOLA horizontal : un simple `agent` voit l'activité d'un autre.
- Recommandation : pour le rôle `agent`, ignorer/forcer `agent_user_id` à son
  propre `user_id` ; n'autoriser le filtre arbitraire qu'aux `admin/manager`.

### M-3 — AMI : RLS inerte côté listener si rôle privilégié, et secret en prod

- Fichiers : `apps/api/app/routers/telephony/ami.py:196-219`
  (`_resolve_company_for_extension` via `async_session_maker` = rôle `sgi_user`
  privilégié, lecture cross-tenant assumée) ; `infra/asterisk/config/manager.conf`.
- Le listener AMI résout `extension → company_id` en lecture cross-tenant : c'est
  **légitime et documenté** (consommateur de fond, comme Celery). Risque : aucune
  écriture privilégiée n'est faite ici (bien), mais comme `extension` n'est unique
  que **par tenant** (`uq_agent_states_extension` = `(company_id, extension)`), si
  deux tenants partagent une extension (ex. plage 6001 réutilisée), `.limit(1)`
  retourne un company_id arbitraire et l'event d'appel peut être **publié sur le
  mauvais tenant**. En dev les extensions test (6001/6002) sont communes → risque
  réel de fan-out croisé.
- `manager.conf` : `secret=${AMI_PASSWORD}` injecté par entrypoint (bien, pas de
  secret en clair dans l'image), `deny=0.0.0.0/0` + `permit` réseau Docker
  interne (bien). Mais `AMI_PASSWORD` a un défaut vide dans
  `app/core/config.py:44` → en prod si non défini, login AMI sans secret.
- Recommandations :
  1. Inclure le `company_id` dans la corrélation de l'event AMI (via le contexte
     d'appel / variable de canal Asterisk) plutôt que de déduire d'une extension
     potentiellement ambiguë, ou garantir l'unicité globale des extensions.
  2. En prod : `AMI_PASSWORD` obligatoire (fail-fast si vide), durcir
     `manager.conf` (TLS AMI, `permit` restreint au sous-réseau API), comme noté
     dans le commentaire du fichier.

---

## FAIBLE

### L-1 — WS : pas de borne sur le nombre de connexions / pas de ré-auth

- `ws.py` : `_connections` est un set en mémoire sans limite par tenant ; un token
  valide peut ouvrir N sockets. Le JWT n'est validé qu'à l'ouverture (pas de
  réévaluation d'expiration sur socket long). Recommandation : cap par
  user/extension + fermeture sur expiration `exp`.

### L-2 — Logs : numéros d'appelant en clair

- `ami.py` (events normalisés incluent `CallerIDNum`) et logs WS (`company`, `ext`)
  ne fuient pas de secret, mais en cas de passage du niveau de log à DEBUG, les
  numéros (donnée personnelle PDPL) pourraient transiter en clair vers Loki.
  Recommandation : masquer/tronquer les numéros dans les logs au-delà de INFO.

---

## Points conformes (vérifiés)

- Loi 1 : `get_call`, `list_calls`, `transition_call`, `get_agent_state`,
  `list_agent_states`, `find_clients_by_phone` filtrent tous par `company_id`.
  Migration 0028 : RLS + policy `tenant_isolation` + index `company_id` sur
  `calls` et `agent_states`. Tests d'isolation ajoutés (get/transition/agents/
  lookup/filtre agent) confirment l'absence de fuite cross-tenant.
- Anti-BOLA WS : `router.py:331-334` refuse (4403) si l'extension demandée ≠
  celle de l'`agent_state` du user dans SON tenant. Tests : extension non détenue,
  extension inconnue, cross-tenant.
- Authz WS : refus 4401 si JWT invalide, sans `company_id`, ou `mfa_pending`
  (`router.py:316`). Tests ajoutés pour les 3 cas.
- RBAC écriture : `POST /calls`, `/calls/{id}/transition`, `/calls/click-to-call`
  gardés `admin/manager/agent` ; rôle `client` → 403 (tests ajoutés).
- Secret AMI non hardcodé (injecté par entrypoint depuis l'env).

---

## Tests livrés

`apps/api/app/routers/telephony/test_telephony_security.py` :
- Isolation : `get`/`transition`/`agents`/`lookup` cross-tenant, filtre
  `agent_user_id` cross-tenant.
- RBAC : `transition` et `click-to-call` interdits au rôle `client` (403).
- WS : extension non détenue (4403), inconnue (4403), `mfa_pending` (4401),
  JWT invalide (4401), token sans `company_id` (4401), isolation cross-tenant.
- PDPL : `recording_url` sans consentement (`xfail` jusqu'à correction H-1).

⚠️ Exécution : bloquée tant que C-1 n'est pas corrigé (conftest importe
`app.main` qui crash). Une fois le wiring corrigé :
`docker compose exec api uv run pytest app/routers/telephony/test_telephony_security.py`.
