# Skill : dev-process v2
# Processus de développement optimisé — SGI

## Quand charger

Charger pour toute demande de développement non triviale : nouvelle fonctionnalité, nouveau module, refactoring, intégration API, nouveau composant complexe.

Ne pas charger pour : correction de bug simple, changement de texte, ajustement de couleur.

---

## Philosophie v2 — Agir vite, vérifier souvent

**Une seule confirmation avant de commencer. Ensuite, autonomie totale.**

- Plan en 3 lignes → validation → développement autonome partie par partie
- TypeScript check obligatoire après chaque fichier créé (`0 erreur = on continue`)
- Screenshot Chrome DevTools après chaque composant UI majeur
- Livraison incrémentale : chaque partie est fonctionnelle avant de passer à la suivante
- 2 lignes de résumé max entre chaque partie, pas de récapitulatif complet

**Exception — nouvelle fonctionnalité** : passer par le workflow « Nouvelle fonctionnalité » ci-dessous *avant* d'attaquer le workflow standard. Cette phase amont (questions → architecte → plan unifié) ne doit jamais être sautée pour une demande qui introduit une feature inédite.

---

## Nouvelle fonctionnalité — workflow spécifique (à exécuter AVANT le workflow standard)

À déclencher **dès que l'utilisateur demande une fonctionnalité qui n'existe pas encore** dans le projet (nouveau module, nouvelle page, nouveau flux métier, intégration externe inédite, nouveau type d'utilisateur, etc.).

À **ne pas** déclencher pour : correction de bug, ajustement d'UI, refactor isolé, ajout de champ à un formulaire existant, traduction manquante.

### Phase A — Découverte (questions + propositions d'amélioration)

Avant toute écriture de code, **toujours** poser des questions à l'utilisateur via `AskUserQuestion` pour lever l'ambiguïté et proposer des améliorations. Objectif : choisir la réponse la plus adaptée au contexte SGI (multi-tenant, RTL, UAE, Golden Visa, etc.).

Types de questions à poser systématiquement :

1. **Scope** — quelles parties précises de la feature sont in-scope vs out-of-scope ?
2. **Persona cible** — agent, manager, légal, comptable, client final, technicien ?
3. **Surface** — backoffice web (`apps/web`), portail public (`apps/portal`), mobile Expo (`apps/mobile`), backend seul, ou plusieurs ?
4. **Données** — nouvelles tables, ou enrichissement de tables existantes ? Lien avec quel module métier ?
5. **Améliorations proposées** — proposer 2–3 améliorations non demandées mais pertinentes (ex. ajouter un suivi audit, brancher Meilisearch, prévoir une variante Golden Visa) et laisser l'utilisateur choisir.

Règle : **maximum 4 questions** par tour, regroupées dans un seul appel `AskUserQuestion`. Toujours jouer le son `Ping.aiff` juste avant (voir « Règle transversale »).

Si la demande est claire à 100 % et qu'aucune amélioration pertinente n'est à proposer → sauter Phase A et passer directement Phase B. Cela doit rester rare.

**Fin de Phase A** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase B — Agent architecte (un seul, en foreground)

Une fois la découverte close, lancer **un agent `Plan`** (architecte logiciel) pour produire la stratégie d'implémentation. Le brief de l'agent doit contenir :

- Le besoin clarifié issu de la Phase A
- Les contraintes SGI applicables : Loi 1 (multi-tenant + RLS), Loi 2 (PostGIS), Loi 3 (RTL Arabe), conventions DB (UUID, soft delete, `created_at/updated_at`, `DECIMAL(15,2)`), patterns API (`router/schemas/service/test_`), i18n AR/EN/FR
- Les fichiers déjà lus en Étape 0 (ne pas redemander à l'agent de les relire)
- La sortie attendue : découpage en parties livrables indépendantes + identification des fichiers critiques + arbitrages architecturaux + risques

Format de l'appel :

```
Agent(
  subagent_type: "Plan",
  description: "Architecture <nom-feature>",
  prompt: "<contexte SGI + besoin clarifié + contraintes + fichiers pertinents + sortie attendue>"
)
```

L'agent tourne en **foreground** — son plan est nécessaire avant de pouvoir continuer.

**Fin de Phase B** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase C — Plan unifié + confirmation utilisateur

Synthétiser le plan de l'architecte en respectant le format « Plan minimal » de l'Étape 1 du workflow standard (3–5 parties max, livrables précis, fichiers cités). Y ajouter :

- Les arbitrages clés retenus (1 ligne chacun)
- Les agents qui seront lancés en Phase D et ce qu'ils feront

→ Jouer `Ping.aiff` → demander confirmation unique à l'utilisateur.

**Fin de Phase C** (une fois la confirmation reçue) → `afplay /System/Library/Sounds/Pop.aiff`

### Phase D — Multi-agents parallèles pour le développement

Une fois le plan validé, **paralléliser autant que possible**. Règle d'or : un seul message contenant N appels `Agent` indépendants pour les charger en parallèle.

Découpage type (à adapter selon la feature) :

| Agent | Rôle | Quand |
|---|---|---|
| `Explore` | Cartographier les zones du code à modifier en profondeur (si non couvert par Étape 0) | Avant Phase D, si besoin |
| `general-purpose` (backend) | Implémenter migration + models + service + router + tests pytest | Phase D |
| `general-purpose` (web) | Implémenter écrans Next.js + composants UI + i18n web | Phase D, parallèle au backend si interface clarifiée |
| `general-purpose` (mobile) | Implémenter écrans Expo + appels API + i18n mobile | Phase D, parallèle |
| `general-purpose` (tests E2E) | Playwright pour le golden path | Après livraison des UI |
| `Explore` (audit final) | Vérifier multi-tenant, RTL, soft delete, i18n sur le diff | Avant livraison finale |

Règles de parallélisation :

- **Indépendance stricte** : ne paralléliser que des agents qui ne s'écrivent pas sur les mêmes fichiers. Sinon, séquencer.
- **Brief auto-suffisant** : chaque agent reçoit toute le contexte nécessaire (il ne voit pas la conversation). Inclure chemins de fichiers, conventions SGI, exemples de patterns existants.
- **Foreground vs background** : foreground quand le résultat est nécessaire pour la suite ; background pour les agents longs et indépendants (tests E2E, audit final).
- Pour les tâches couvrant analyse + dev + tests + audit en simultané, déléguer au skill `parallel-agents` qui définit le pipeline 6 phases complet.

**Fin de Phase D** (tous les agents ont retourné leur résultat) → `afplay /System/Library/Sounds/Pop.aiff`

### Phase E — Intégration & vérifications par fichier

Récupérer les sorties des agents, les intégrer dans la branche courante, puis pour **chaque fichier modifié ou créé**, appliquer la checklist du workflow standard (Étape 3) :

- [ ] **CSS logique** — `ms-` `me-` `ps-` `pe-` jamais `ml-` `mr-` `pl-` `pr-`
- [ ] **Multi-tenant** — `company_id` + RLS sur toute nouvelle table, filtre dans chaque requête
- [ ] **TypeScript strict** — aucun `any` non documenté
- [ ] **Server Components** — `"use client"` seulement si hooks/handlers
- [ ] **AED** — `Intl.NumberFormat("en-AE", { currency: "AED" })` avec chiffres latins
- [ ] **Soft delete** — `deleted_at` nullable, jamais de `DELETE FROM`
- [ ] **i18n** — toutes les chaînes visibles passent par `useT()` / `t.xxx`

Corriger immédiatement toute violation (Edit ciblé), sans déléguer à un agent — c'est plus rapide en direct.

**Fin de Phase E** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase F — Vérification visuelle (Chrome DevTools MCP)

Pour chaque composant UI majeur livré, utiliser le MCP chrome-devtools pour :

```
mcp_puppeteer_navigate(url: "http://localhost:3000/<route>")
mcp_puppeteer_screenshot(name: "desktop")
mcp_puppeteer_evaluate(script: "window.resizeTo(390, 844)")
mcp_puppeteer_screenshot(name: "mobile")
mcp_puppeteer_evaluate(script: "document.documentElement.setAttribute('dir','rtl')")
mcp_puppeteer_screenshot(name: "rtl")
```

Vérifier : layout, débordements, responsive, RTL Arabe, contrastes, modals centrés/fermables, console sans erreur JS.

Tout défaut visuel → corriger immédiatement avant de passer à la phase suivante.

**Fin de Phase F** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase G — Tests automatisés

Lancer en parallèle (un seul message) tous les contrôles automatiques :

```bash
cd apps/web   && npx tsc --noEmit
cd apps/api   && docker compose exec api uv run pytest app/routers/<module>/test_<module>.py
pnpm vitest run
make lint
```

Pour une feature couvrant plusieurs surfaces (web + mobile + backend), lancer aussi `apps/mobile && npm run typecheck`.

Zéro erreur obligatoire avant de continuer. Échec → corriger la racine du problème, jamais désactiver ou contourner.

**Fin de Phase G** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase H — Audit qualité final (agents parallèles)

Lancer **en parallèle** (un seul message contenant plusieurs `Agent`) trois audits indépendants sur le diff de la branche :

| Agent | Mission |
|---|---|
| `Explore` — audit sécurité | Vérifier secrets, validation aux frontières, injection SQL, OWASP top 10, multi-tenant strict |
| `Explore` — audit RTL + i18n | Détecter `ml-/mr-/pl-/pr-/left-/right-` résiduels, chaînes en dur non traduites, manques AR/EN/FR |
| `Explore` — audit perf | Détecter N+1, requêtes sans index, `"use client"` superflu, bundle bloat |

Chaque agent retourne un rapport court. Corriger les findings critiques ; documenter les findings mineurs dans le résumé final.

**Fin de Phase H** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase I — Livraison & commit

Avant tout commit : `git status` + `git diff` pour relire le diff complet. **Ne jamais committer** sans relire.

1. Demander confirmation à l'utilisateur pour le commit (jouer `Ping.aiff` avant).
2. Une fois validé : stager les fichiers explicitement (pas de `git add .`), commit au format `type(module): description en français` (cf. CLAUDE.md).
3. Ne **jamais** push sans demande explicite de l'utilisateur.
4. Si demande de PR : utiliser `gh pr create` avec titre < 70 caractères et corps structuré (Summary + Test plan).

**Fin de Phase I** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase J — Mémoire & clôture

1. Mettre à jour la mémoire auto (`~/.claude/projects/-Users-sadiki/memory/`) si la feature a révélé une convention durable, une préférence utilisateur, une contrainte projet non documentée.
2. Résumer la livraison en 3 lignes max (cf. « Résumé de livraison »).
3. Signaler les éventuels suivis (findings non bloquants, dette technique introduite, tâches de Phase J reportées).
4. Jouer `Hero.aiff` (livraison finale).
5. Écrire « fin de tache » conformément à la mémoire utilisateur (cf. section « Messages de fin obligatoires »).

**Fin de Phase J** → `afplay /System/Library/Sounds/Pop.aiff` puis `afplay /System/Library/Sounds/Hero.aiff`

### Phase K — Documentation projet

Mettre à jour la documentation technique impactée par la feature :

1. **`CLAUDE.md`** — si la feature introduit un nouveau module, un nouveau pattern ou modifie un pattern existant, ajouter / amender la section concernée (structure module API, conventions, helpers métier).
2. **`README.md`** du module — si le module a un README, refléter les nouvelles routes / helpers / état machine.
3. **Migrations Alembic** — vérifier que le message de migration décrit clairement l'intention (`alembic revision -m "..."`).
4. **OpenAPI / Swagger** — pour toute nouvelle route, vérifier que les schémas Pydantic v2 produisent une doc lisible sur `/docs` (descriptions, exemples, codes d'erreur).
5. **Diagrammes** — si la feature touche à la hiérarchie physique (`buildings/floors/units`), au pattern party-role, ou au state machine PDC, mettre à jour le diagramme correspondant.

Règle : la documentation suit le code dans le même commit ou dans un commit immédiatement suivant — jamais en différé.

**Fin de Phase K** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase L — Observabilité & monitoring

Brancher les rails opérationnels SGI pour que la feature soit observable en production :

| Couche | À vérifier |
|---|---|
| **Sentry** | Erreurs backend (FastAPI) et frontend (Next.js, Expo) remontent avec contexte `company_id`, `user_id`, route |
| **Loki / Promtail** | Logs structurés JSON, niveau approprié (`info`, `warning`, `error`), pas de fuite de PII |
| **Prometheus / Grafana** | Si la feature introduit une métrique métier critique (taux de conversion lead, latence d'un endpoint chaud, nombre de PDC bouncés), créer le compteur/histogramme et l'ajouter au tableau de bord pertinent |
| **Celery** | Nouvelles tâches asynchrones : timeouts définis, retries bornés, dead-letter queue prévue |
| **Healthcheck** | Si nouveau service externe (API tierce, MCP, webhook), l'ajouter à `make healthcheck` |

Pour les features critiques (paiement, signature contrat, Golden Visa, PDC), exiger une alerte Grafana liée à la métrique principale.

**Fin de Phase L** → `afplay /System/Library/Sounds/Pop.aiff`

### Phase M — Rétrospective & amélioration continue

Boucler la feature en capitalisant :

1. **Findings non bloquants** reportés en Phase H → créer une issue GitHub (ou un TODO daté) plutôt que de les oublier.
2. **Dette technique introduite** consciemment → la mentionner explicitement dans le message de commit et / ou la sauvegarder en mémoire projet.
3. **Patterns réutilisables** détectés pendant la feature → proposer à l'utilisateur de les extraire (composant `packages/ui`, helper backend partagé, type dans `packages/shared-types`).
4. **Anti-patterns repérés** dans le code existant que la feature a touché → noter pour un refactor ultérieur, ne pas le faire dans le même commit (scope creep).
5. **Mémoire `feedback`** — si l'utilisateur a corrigé un choix pendant la feature, sauvegarder la règle issue de la correction (avec **Why** et **How to apply**, cf. système de mémoire).
6. **Mémoire `project`** — si la feature a révélé un état projet (deadline, contrainte stakeholder, décision produit), le persister.

**Fin de Phase M** → `afplay /System/Library/Sounds/Pop.aiff`

### Tableau récapitulatif des phases (A → M)

| Phase | Objet | Sortie | Son fin |
|---|---|---|---|
| A | Découverte (questions + propositions) | Besoin clarifié | `Pop` |
| B | Architecte (agent `Plan`) | Stratégie d'implémentation | `Pop` |
| C | Plan unifié + confirmation utilisateur | Go/no-go | `Pop` |
| D | Multi-agents parallèles (dev) | Code livré par les agents | `Pop` |
| E | Intégration & vérifications par fichier | Checklist 7 points OK | `Pop` |
| F | Vérification visuelle (Chrome DevTools) | Screenshots desktop / mobile / RTL | `Pop` |
| G | Tests automatisés (tsc, pytest, vitest, lint) | 0 erreur | `Pop` |
| H | Audit qualité (3 agents : sécu, RTL+i18n, perf) | Rapports + corrections | `Pop` |
| I | Livraison & commit | Commit (+ PR si demandée) | `Pop` |
| J | Mémoire & clôture | Résumé + « fin de tache » | `Pop` + `Hero` |
| K | Documentation projet | CLAUDE.md, README, OpenAPI à jour | `Pop` |
| L | Observabilité & monitoring | Sentry / Loki / Grafana branchés | `Pop` |
| M | Rétrospective & amélioration continue | Issues, dette, mémoire enrichie | `Pop` |

Les phases K, L, M sont **optionnelles selon la criticité** de la feature : pour une feature mineure on s'arrête à J ; pour une feature critique (paiement, contrat, Golden Visa, multi-tenant structurant) **les trois sont obligatoires**.

---

## Workflow standard (modifications, refactors, features mineures)

### Étape 0 — Lire d'abord (toujours en parallèle)

Avant d'écrire une seule ligne, lire tous les fichiers pertinents en un seul message :

```
Read(screen cible) + Read(composants UI réutilisés) + Read(i18n.ts) + Read(sgi-ui.tsx partiel)
```

Identifier : composants existants, patterns utilisés, imports disponibles, données déjà présentes.

---

### Étape 1 — Plan minimal

Présenter sous cette forme exacte, sans texte superflu :

```
Partie 1 — [livrable précis]  → fichiers : X, Y
Partie 2 — [livrable précis]  → fichiers : Z
Partie 3 — [livrable précis]  → fichiers : W
```

→ **Confirmation unique**, puis développement sans interruption.

---

### Étape 2 — Développer partie par partie

Pour chaque partie, dans l'ordre :

1. **Écrire le code** — Edit (modification ciblée) ou Write (nouveau fichier)
2. **TypeScript check** — `npx tsc --noEmit` depuis `apps/web` → 0 erreur obligatoire
3. **Screenshot** via MCP chrome-devtools (si composant UI visible)
4. **Annoncer** le résultat en 2 lignes maximum, puis attaquer la partie suivante

---

### Étape 3 — Vérifications obligatoires par fichier

Avant de marquer une partie terminée, vérifier :

- [ ] **CSS logique** — `ms-` `me-` `ps-` `pe-` `start-` `end-` · jamais `ml-` `mr-` `pl-` `pr-` `left-` `right-`
- [ ] **Multi-tenant** — `company_id` sur toutes nouvelles tables, filtre dans chaque requête
- [ ] **TypeScript strict** — aucun `any` non documenté, types explicites sur tous les props
- [ ] **Server Components** — `"use client"` uniquement si hooks React ou event handlers
- [ ] **Montants AED** — `Intl.NumberFormat("en-AE", { currency: "AED" })` — chiffres latins toujours
- [ ] **Soft delete** — `deleted_at TIMESTAMPTZ` nullable, jamais de `DELETE FROM`
- [ ] **i18n** — toutes les chaînes visibles passent par `useT()` / `t.xxx`

---

## Chrome DevTools MCP — Vérification visuelle

Après chaque composant UI majeur (page, modal, panneau), utiliser le MCP chrome-devtools pour :

```bash
# Naviguer vers la page en développement
mcp_puppeteer_navigate(url: "http://localhost:3000")

# Screenshot desktop
mcp_puppeteer_screenshot(name: "desktop")

# Screenshot simulé mobile (viewport réduit)
mcp_puppeteer_evaluate(script: "window.resizeTo(390, 844)")
mcp_puppeteer_screenshot(name: "mobile")

# Vérifier la console (erreurs JS, warnings React)
mcp_puppeteer_evaluate(script: "window.__errors ?? []")
```

Vérifier sur le screenshot :
- Layout général et alignement
- RTL correct si langue arabe
- Pas de débordement (`overflow` non voulu)
- Responsive mobile vs desktop
- Couleurs et contrastes cohérents avec le design system
- Modals et drawers centrés et fermables

---

## Patterns d'efficacité

### Lecture parallèle (toujours)
```
# Un seul message pour N fichiers — jamais séquentiellement
Read(A) + Read(B) + Read(C)
```

### Écriture ciblée
- `Edit` — modifier : old_string doit être la chaîne minimale unique dans le fichier
- `Write` — nouveaux fichiers uniquement, ou réécriture complète justifiée
- Ne jamais réécrire un fichier entier pour changer 3 lignes

### TypeScript check systématique
```bash
# Toujours depuis apps/web
cd /Users/sadiki/Desktop/SGI/SGI_Project/apps/web && npx tsc --noEmit 2>&1
```
Des erreurs → corriger immédiatement avant la partie suivante.

### Structure standard d'un nouveau screen
```
1. "use client" + imports React + imports sgi-ui + imports hooks
2. Types TypeScript (type Foo = { ... })
3. Données/constantes (ITEMS: Foo[], STATUS_MAP, etc.)
4. Sous-composants utilitaires (du plus simple au plus complexe)
5. Composant principal (ScreenXxx)
6. Modals / drawers (si applicables)
```

### Structure standard d'un modal multi-étapes
```
1. Type PropForm avec tous les champs
2. INIT_FORM constant
3. Helper components inline (FField, Pills, TagChip)
4. Composant modal avec useState(step) et useState(form)
5. Validation canAdvance par étape
6. Footer Back/Next/Save avec disabled si invalide
```

---

## Checklist avant livraison finale

```bash
npx tsc --noEmit          # TypeScript : 0 erreur
```

Si disponible :
```bash
make lint                  # ESLint + Ruff
pnpm vitest run            # Tests unitaires
```

---

## Résumé de livraison (format standard)

```
[Partie X terminée]
Ce qui a été ajouté : [liste en bullets, 1 ligne chacun]
Prochaine partie recommandée : [description courte]
```

---

## Sons de progression

| Moment | Commande |
|---|---|
| **Fin de phase** (A → M, workflow nouvelle fonctionnalité) | `afplay /System/Library/Sounds/Pop.aiff` |
| Partie terminée (workflow standard) | `afplay /System/Library/Sounds/Glass.aiff` |
| Livraison finale | `afplay /System/Library/Sounds/Hero.aiff` |
| Demande de confirmation (toute question bloquante) | `afplay /System/Library/Sounds/Ping.aiff` |

**Règle** : le son de fin de phase est joué **systématiquement** au dernier acte de chaque phase (A à J), avant de passer à la suivante. Il sert de balise audible : l'utilisateur entend la progression sans avoir à regarder l'écran.

---

## Messages de fin obligatoires — « fin de tache » & « fin de la demande »

Règle **transversale** s'appliquant à toute demande de l'utilisateur, qu'elle relève du workflow standard ou du workflow nouvelle fonctionnalité.

Deux signaux explicites sont attendus :

### 1. Fin de chaque tâche complétée → `fin de tache`

À écrire **sur sa propre ligne, en tout dernier** dans le message, dès qu'une tâche unitaire confiée par l'utilisateur (ou une sous-tâche déclarée dans le todo plan) est terminée et livrée. C'est le signal qu'il peut donner la prochaine instruction.

Cas concrets :
- Une partie du workflow standard est livrée (Étape 2 partie X terminée).
- Une phase du workflow nouvelle fonctionnalité est close (fin de Phase A, B, …, M).
- Une tâche autonome ponctuelle (bug fix, ajout de champ, ajustement UI, etc.) est livrée.

**Ne jamais omettre** : sans ce signal, l'utilisateur ne sait pas si Claude a fini ou s'attend à plus de travail.

### 2. Fin de la demande principale → `fin de la demande`

À écrire **sur sa propre ligne, après « fin de tache »**, lorsque **l'ensemble** de la demande globale de l'utilisateur est livré — toutes les sous-tâches du plan ont été clôturées, les audits sont passés, le commit (si demandé) est fait, et il n'y a plus de prochaine étape automatique côté Claude.

Cas concrets :
- Toutes les Parties du « Plan minimal » sont livrées et vérifiées.
- Phase M (rétrospective) terminée pour une feature critique, ou Phase J pour une feature mineure.
- L'utilisateur attend désormais sa propre prochaine instruction, pas une suite automatique.

Format conjoint en fin de message final :

```
fin de tache
fin de la demande
```

Si la demande globale tient en une seule tâche, écrire les deux signaux ensemble en clôture. Si la demande comprend plusieurs tâches, « fin de tache » apparaît à la clôture de chacune, et « fin de la demande » uniquement à la dernière.

---

## Règle transversale — Son à chaque demande de confirmation

Règle **indépendante** du workflow ci-dessus. Elle s'applique partout, à tout moment, quelle que soit l'étape en cours.

**Dès que tu t'apprêtes à poser une question bloquante à l'utilisateur**, joue le son d'alerte **juste avant** d'envoyer le message :

```bash
afplay /System/Library/Sounds/Ping.aiff
```

Cas couverts (liste non exhaustive) :
- Validation d'un plan, d'une approche, d'un choix d'architecture
- Avant toute action irréversible (suppression, push --force, drop, reset --hard)
- Avant toute action à effet partagé (push, PR, commentaire GitHub, message externe)
- Fin de phase nécessitant un go/no-go
- Question ouverte via `AskUserQuestion`
- Ambiguïté à lever avant de continuer

Objectif : alerter l'utilisateur **par le son** qu'une intervention humaine est requise — sans son, la demande peut passer inaperçue dans une autre fenêtre.

---

## Orchestration multi-agents

Pour toute tâche couvrant analyse + dev + tests + audit en même temps, charger le skill **`parallel-agents`** qui définit le pipeline complet 6 phases et les règles de coordination :

```
Phase 1 : Analyse (Explore)  →  Phase 2 : Dev parallèle  →  Phase 3 : Tests
Phase 4 : Audit (sécurité + i18n + perf)  →  Phase 5 : Validation TS  →  Phase 6 : GitHub PR
```

---

## Anti-patterns à éliminer

| Interdit | Raison |
|---|---|
| Réécrire un fichier entier pour 3 lignes | Edit est plus sûr et plus rapide |
| Lire les fichiers séquentiellement | Lecture parallèle = 3× plus rapide |
| Passer à la partie suivante avec des erreurs TS | Les erreurs s'accumulent et bloquent |
| CSS physique `ml-` `mr-` dans un composant partagé | Casse le RTL arabe |
| `"use client"` par défaut | Les Server Components sont plus performants |
| Ajouter des features non demandées | Scope creep, complexité inutile |
| Récapitulatif complet entre chaque partie | Bruit inutile, ralentit la lecture |
| Commits avec des secrets ou console.log | Risque sécurité |
| Confirmation à chaque micro-étape | Ralentit inutilement le développement |
