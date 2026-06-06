# MISSION — Lot #6 SGI (4 fonctionnalités net-neuf)

> **Comment utiliser ce fichier** : ouvre-le sur la machine cible (après `git pull`),
> copie tout le bloc ci-dessous comme **premier message** d'une nouvelle session
> Claude Code à la racine du dépôt SGI. `CLAUDE.md` se charge automatiquement.

Tu es sur le dépôt SGI (CLAUDE.md chargé). Exécute les 4 tâches ci-dessous, en
autonomie, chacune dans son cycle complet. Ne demande pas de "go" entre les
étapes : permission d'enchaîner. Le merge de chaque PR est autorisé dès que
(CI verte CLEAN + Carte de Fusion postée) — convention « GO #PR ».

## RÈGLES DURES (non négociables)
- JAMAIS développer/committer sur `main`. Une branche par tâche : `type/desc`,
  créée depuis `origin/main` (`git fetch` d'abord).
- JAMAIS `git add -A` : stage uniquement les fichiers explicites de la tâche.
  Ne committe JAMAIS un lockfile non voulu (`git checkout -- <lock>` si churn).
- Respecter les 3 Lois (CLAUDE.md) : Loi 1 company_id+RLS (cross-tenant → 404 ou
  vide), Loi 2 PostGIS `::geography`, Loi 3 CSS logique (ms/me/ps/pe/start/end).
- Valider sur l'HÔTE avant push : dans `apps/api` → `uv run ruff format` +
  `uv run ruff check` + `uv run mypy <fichiers>` ; côté web →
  `pnpm --filter sgi-web typecheck` + `npx eslint <fichiers>` +
  `pnpm --filter sgi-web exec vitest run`. pytest tourne en CI (Postgres réel).
- Pré-push backend : `uv run ruff format` (pas seulement check) sinon CI rouge.

## GATE DE FUSION (par PR)
1. Brancher sur origin/main, développer, tests co-localisés `test_{module}.py`.
2. Pousser, ouvrir la PR, attendre la CI : exiger `mergeStateStatus == CLEAN`
   ET vérifier que le run vert est bien sur le HEAD de la PR (pas un run périmé) :
   `gh run view <id> --json headSha`.
3. Poster une "Carte de Fusion" en commentaire (tableau go/no-go : tests,
   couverture, Loi 1 Red-Team cross-tenant, Loi 2, Loi 3, OWASP, perf, CI).
4. `gh pr merge <n> --squash` SANS `--delete-branch` → confirmer `state==MERGED`
   → supprimer la branche distante à part → `git fetch` + resync sur origin/main.

## PRÉ-VOL (à refaire AVANT de coder)
- `gh pr list --state open` : repérer les PR // et leurs fichiers
  (`gh pr view <n> --json files`). NE PAS toucher leurs fichiers.
  Connu au départ : #210 `ci/typecheck-mobile` → `.github/workflows/ci.yml`,
  `apps/mobile/hooks/useDebounce.ts` → à éviter.
- Migration head au moment de la rédaction = `0059` → prochain numéro libre
  `0060` (revérifier : `ls apps/api/migrations/versions | sort | tail`).

## GOTCHAS (vécus cette session)
- `app/routers/__init__.py` réaliase certains paquets en APIRouter (clients,
  contracts, properties, …). Pour monkeypatcher un symbole d'un sous-module de
  CES paquets, patcher l'OBJET module importé, PAS la chaîne
  `"app.routers.clients.X.y"` (qui résout `clients`→APIRouter et casse).
- En CI : pas de MinIO/Meili/réseau Google → coder en "best-effort/console" et
  tester les chemins de repli ; monkeypatcher storage/httpx/render_pdf pour le
  happy path.
- Validateurs Pydantic : `ClientCreate` exige `company_name` si type=company,
  `first_name|last_name` si individual ; `PropertyCreate` exige `type`+`price`.
- Mobile (si jamais touché) : `.expo/types` périmé donne de faux positifs `Href`
  au typecheck local ; CI fait un install propre. Ne PAS committer package-lock.

---

## TÂCHE 1 — Géocodage automatique (Google Maps)  [branche feat/properties-geocoding]
But : à la création/import d'un bien AVEC adresse mais SANS lat/lng, géocoder
l'adresse → coordonnées → point PostGIS.
- Backend : helper `app/core/geocoding.py` (miroir de `app/core/push.py` :
  `is_configured()` via `GOOGLE_MAPS_API_KEY`, **console/no-op si non configuré**,
  `httpx` sync, fonction pure `build_geocode_request` + parse de la réponse).
  Config (`app/core/config.py`) : `GOOGLE_MAPS_API_KEY=""`, `GEOCODING_ENABLED=False`,
  `GEOCODING_ENDPOINT="https://maps.googleapis.com/maps/api/geocode/json"`.
- Brancher dans `properties/service.create_property` : si `latitude/longitude`
  None et (`address_en`/`district`/`city`) présents → géocoder, remplir le point
  via `_make_point`. Idem pour l'import biens (`/properties/import.csv` existant).
  Cache optionnel : table `geocode_cache` (migration 0060) OU Valkey TTL — sinon
  s'en passer pour la v1.
- Tests : `build_geocode_request` pur ; no-op quand désactivé ; parse réponse
  mockée (httpx monkeypatché) ; create_property géocode quand coords absentes.
- Réf CLAUDE.md : "Geocode once via Google Maps API at creation time, store in DB".

## TÂCHE 2 — Indexation Meilisearch auto sur CRUD  [branche feat/search-autoindex]
But : garder l'index `backoffice` (#224) à jour automatiquement.
- Réutiliser `app/routers/search/meili.py` (`reindex`, `doc_id`). Ajouter
  `meili.delete_doc(company_id, entity_type, entity_id)` (best-effort).
- Hooks best-effort (try/except, jamais bloquant) dans les services `properties`,
  `clients`, `contracts` : après create/update → `meili.reindex(cid, [doc])` ;
  après soft-delete → `meili.delete_doc(...)`. Factoriser un `build_search_doc_*`
  pur (entity_type, id, label, subtitle, reference) testé.
- Tests : `build_search_doc_*` purs ; les hooks ne lèvent pas si Meili down
  (monkeypatch httpx pour lever → le service réussit quand même).

## TÂCHE 3 — PDF état des lieux (inspections)  [branche feat/inspections-pdf]
But : générer le PDF d'un état des lieux signé → MinIO → URL présignée.
- Cloner EXACTEMENT `app/routers/contracts/contract_pdf.py` (lui-même calqué sur
  `finance/invoice.py`) → `inspections/inspection_pdf.py` : `build_inspection_html`
  (pur, EN/AR, échappement) + `generate_and_store_inspection` (réutiliser
  `render_pdf` de finance.invoice ; storage MinIO `etats_des_lieux/{company}/{ref}.pdf`).
- Endpoint `POST /inspections/{id}/pdf` (admin/manager/agent), 404 cross-tenant.
- Front : bouton « PDF » dans `apps/web/app/screens/realestate-inspections.tsx`
  + proxy `apps/web/app/api/admin/inspections/[id]/pdf/route.ts` (via `proxy`).
- Tests : HTML pur + endpoint (happy path storage/render monkeypatchés — patcher
  l'OBJET module si inspections est aliasé —, inconnu 404, cross-tenant 404).

## TÂCHE 4 — Tableau de bord par agent  [branche feat/reporting-agent-dashboard]
But : pilotage par agent (leads, conversion, contrats signés, commissions).
- Backend : `reporting` (ou service dédié) : agrégations scopées company_id par
  `agent_id`/`assigned_agent_id` (CRM leads, contracts signés+commissions, finance).
  Helper pur de calcul des KPIs + endpoint `GET /reporting/agents`.
- Front : nouvel écran web (pattern `apps/web/app/screens/finance.tsx` : i18n
  LOCAL via useLang, PAS i18n.ts ; CSS logique). Enregistrer dans la nav (page.tsx
  registre+type, sgi-ui.tsx type+nav+label, i18n key) — VÉRIFIER d'abord qu'aucune
  PR // ne touche page.tsx/sgi-ui.tsx (sinon rebase).
- Tests : KPIs purs + endpoint (Loi 1 : agent d'un autre tenant invisible) +
  vitest sur les helpers front.

---

## RÉUTILISER (déjà dans le repo — gain de temps)
- Multipart front : `lib/api-proxy.ts::proxyMultipart` + `lib/api-client.ts::postForm`.
- Import CSV (modèle) : `clients/service.py::parse_client_rows`,
  `clients/router.py::import_clients_csv`, `components/client-csv-import.tsx`,
  `properties/service.py::parse_property_rows` + `/properties/import.csv`.
- Carte/PostGIS : `properties/service.py::search_by_radius`/`_make_point`,
  composant `components/re-map.tsx` (`ReMap`, SSR-off).
- PDF : `finance/invoice.py::render_pdf` (WeasyPrint lazy), `contracts/contract_pdf.py`.
- Search : `search/meili.py`, `search/service.py`.
- Push / "console si désactivé" (modèle pour la clé Google) : `core/push.py`.
- Notifications WS + ws-ticket : `notifications/ws.py`, `notifications/router.py`.

À la fin de chaque tâche : mini-récap + « fin de tache ».
Ordre suggéré : **3 (rapide) → 1 → 2 → 4 (le plus long)**. Durée estimée ≈ 2–3 h
wall-clock (majoritairement attente CI).
