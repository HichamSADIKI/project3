---
name: centre-de-commande
description: Orchestre le développement d'une feature/module « mode architecte » avec un visuel terminal créatif (📡 RADAR test fonctionnel · ✈️ CHASSEUR audit sécurité · 🛡️ DÔME DE FER intégration). Découpe la spec en fonctions simples, dev → test → audit → intégration supervisée fonction par fonction, puis test+audit du module entier, Carte de Fusion et merge git après GO. À utiliser quand l'utilisateur veut piloter le dev de façon orchestrée et visuelle (« mode architecte », « centre de commande », « pilote le dev », « radar/chasseur/dôme »). Invocable /centre-de-commande.
---

# Skill : centre-de-commande
# Centre de Commande — développement orchestré « mode architecte » + visuel radar / chasseur / Dôme de fer — SGI

> Habillage des 3 métaphores de la doctrine [`@core/security`](../../../docs/architecture/security-core.md)
> appliquées au **cycle de développement** :
> **📡 RADAR** = test fonctionnel · **✈️ CHASSEUR** = audit sécurité (l'avion décolle et attaque) ·
> **🛡️ DÔME DE FER** = intégration par le superviseur (le dôme se ferme = protection lancée, fonction verrouillée).

## Quand charger

- L'utilisateur veut **développer une feature/un module de façon orchestrée et visuelle** : « mode
  architecte », « centre de commande », « pilote le dev », « organise le dev », « radar/chasseur/dôme ».
- Toute demande de dev qui se découpe en **≥ 2 fonctions** et mérite un suivi visuel + une gate de fusion.
- Invocable explicitement `/centre-de-commande [spec]`.

Ne pas charger pour : une correction triviale d'un seul fichier sans découpage (utiliser le workflow
standard de `dev-process`).

## Ce qu'il compose (ne pas réinventer)

| Brique réutilisée | Rôle ici |
|---|---|
| `saas-architect` | Phase 0 ARCHITECTE quand le module est stratégique (archi/AI/scalabilité). |
| `parallel-agents` | Vague de DEV : N agents en parallèle sur des fonctions **non chevauchantes** + agents validateur/test/audit. |
| `progression` | **Algo de barre** (12 car., `█`/`░`) réutilisé tel quel pour la ligne GLOBAL. |
| `dev-process` | Discipline (checklist 7 points, vérif TS strict, RTL/i18n, AED) + **sons** `Pop`/`Ping`/`Hero`. |
| CLAUDE.md « Gate de fusion » | La phase GIT finale = cette gate (worktree → test → Red-Team → Carte de Fusion → GO). |
| Mémoires | `dev-workflow-orchestre-architecte` · `superviseur-tableau-dev` · `explain-before-coding-function`. |

---

## Le pipeline (rôles + phases)

### Phase 0 — 🧠 ARCHITECTE (Opus)
1. Découpe la spec en **fonctions simples et autonomes `F1…Fn`**. Pour chaque `Fi` : **but**, **entrée →
   sortie**, **fichiers** touchés, **test associé**, et **dépendances explicites** (quelle `Fj` doit être
   prête avant).
2. Planifie le dev **par vagues** respectant les dépendances (une vague = fonctions indépendantes,
   développables en parallèle).
3. Affiche le **Centre de Commande initial** (toutes les fonctions ⏳) + une ligne d'orientation.
4. **Stop** : présente le découpage + le plan, joue `Ping.aiff`, **attend le GO** de l'utilisateur avant
   de coder (sessions parallèles — ne jamais démarrer sans GO).

### Boucle par fonction `Fi` (ordre des dépendances)
Fonctions indépendantes d'une même vague → DEV en parallèle (`parallel-agents`). Sinon séquentiel.

1. **Explication courte** — avant d'écrire le code, expliquer en clair ce que fait `Fi` (but,
   entrées/sorties). *(mémoire `explain-before-coding-function`)*
2. **🔧 DEV** de `Fi` (respect des 3 Lois dès le code : `company_id`+RLS, PostGIS, CSS logique RTL).
3. **📡 RADAR — test fonctionnel** : balayage de `Fi`.
   - `tsc --noEmit` · `pytest` (en conteneur) · `vitest` · `ruff format --check` + `ruff check`.
   - **Exercice réel** : codes 200/4xx attendus, machines à états, **couverture ≥ 80 %** sur le neuf.
   - Sortie : `n signaux / k critiques`. **k = 0 obligatoire** pour avancer.
4. **✈️ CHASSEUR — audit sécurité** : l'avion décolle et **attaque** `Fi` (adversarial).
   - **3 Lois + OWASP + zones sensibles** (MFA, BOLA owner/payments/tenant, authz WS, rôle `sgi_app`, secrets).
   - **Red-Team locataire éphémère** : 2ᵉ société + 2ᵉ utilisateur, rejoue chaque endpoint de `Fi` en
     **cross-tenant** (Loi 1) et **cross-utilisateur** (BOLA horizontal).
   - **Toute réponse ≠ `404`/vide = no-go bloquant.**
5. **🛡️ DÔME DE FER — intégration superviseur** : si **RADAR vert ET CHASSEUR vert** → le superviseur
   intègre `Fi` et publie un **résumé de la fonction** (3-5 bullets : ce qu'elle fait, fichiers, tests,
   risques résolus). Le dôme se ferme sur `Fi` → **✅ verrouillée**. Sinon : correction + re-RADAR/re-CHASSEUR.
   - **Règle dure** : on ne passe **jamais** à `Fi+1` tant que `Fi` n'est pas **intégrée ET testée**.
6. **Mise à jour du Centre de Commande** + `Pop.aiff`.

### Phase finale — MODULE (après TOUTES les fonctions)
- **📡 RADAR module** : suite de tests **intégrale** du module + E2E (Playwright).
- **✈️ CHASSEUR module** : audit sécurité **adversarial complet** du module (escadrille) + Red-Team global.
- **Résumé du travail** = **Carte de Fusion** : tableau **go/no-go par dimension** — tests · couverture ·
  **Loi 1 (Red-Team)** · Loi 2 · Loi 3 · OWASP · perf · CI verte.

### Phase GIT — 🛡️ DÔME GÉNÉRAL
- Branche dédiée **dans un worktree isolé** sur `origin/main` (jamais l'arbre principal, évite le churn WIP).
- `ruff format` pré-push → commits `type(module): …` (français) → push → **PR** avec la Carte de Fusion.
- `Ping.aiff` → **attendre le GO explicite** (« GO #PR »). **Aucun merge auto.**
- Après GO : merge **sans `--delete-branch`** → suppression de la branche distante séparément → resync `main`
  → retrait du worktree. Le **Dôme général se ferme** = module protégé sur `main` → `Hero.aiff`.
- **Puis attendre les instructions** de l'utilisateur.

---

## Spec du visuel « Centre de Commande » (rendu terminal)

**Gabarit complet (à reproduire) :**

```
╭─ CENTRE DE COMMANDE — Module: <nom> ──────────────────────╮
│  GLOBAL   ███████░░░░░  62 %   (5/8 fonctions protégées)   │
├────────────────────────────────────────────────────────────┤
│  📡 RADAR    test fonct.   ◐ balayage… F6                  │
│        · · ✦ · · ✦ · ·     3 signaux / 0 critique          │
│  ✈️  CHASSEUR audit sécu   ▲ décollage F6                  │
│        cross-tenant ✓404   BOLA ✓   secret ✓               │
│  🛡️  DÔME DE FER intégration                               │
│        F1✅ F2✅ F3✅ F4✅ F5✅  F6⧗  F7⏳ F8⏳             │
╰────────────────────────────────────────────────────────────╯
Prochaine action : F6 — CHASSEUR sur l'endpoint POST /favorites.
```

**Ligne GLOBAL — barre (algo repris de `progression`) :**
- Largeur fixe **12 caractères** ; `rempli = round(% / 100 × 12)` ; plein `█`, vide `░`.
- Le **%** = moyenne des fonctions (une fonction ✅ verrouillée = 100 %, en cours = part réelle, ⏳ = 0 %).
- Suivi de `(X/N fonctions protégées)` — X = fonctions sous le Dôme (✅).

**Les 3 rubriques :**
- `📡 RADAR test fonct.` → état `◐ balayage…` / `✓` / `❌` + ligne signaux `· · ✦ · ·` (`n signaux / k critiques`).
- `✈️ CHASSEUR audit sécu` → état `▲ décollage` / `✓` / `❌` + checks `cross-tenant ✓404  BOLA ✓  secret ✓`.
- `🛡️ DÔME DE FER intégration` → grille des fonctions `F1✅ F2✅ … Fi⧗ … Fn⏳`.

**Icônes d'état :** `⏳` à faire · `🔧` en dev · `◐` radar balaye · `▲` chasseur décolle · `⧗` en cours ·
`✅` verrouillée (dôme fermé) · `❌` signal critique / no-go.

**« Animations » textuelles** (une frame par affichage, au fil des phases) :
- RADAR (balayage) : `· · · ✦ ·` → `· ✦ · · ·` → `✦ · · · ·`
- CHASSEUR (décollage → attaque) : `▁▂▃▴▲ ✈` → `✈ ⤳ 🎯`
- DÔME (fermeture = protection lancée) : `◜     ◝` → `◜▩▩▩◝` → `🛡️ fermé`

**Règles de présentation :**
- Libellés tronqués ~28 car. ; % sur 3 car. + ` %` ; ligne GLOBAL **toujours en premier**.
- **Une seule** ligne d'orientation sous le cadre (prochaine action ou blocage).
- Afficher : après le découpage (Phase 0), à chaque fin de RADAR/CHASSEUR/DÔME d'une fonction, et à la
  Carte de Fusion finale.

**Variante compacte** (sans cadre — pour résumés ou > 10 fonctions) :

```
Centre de Commande — <nom>   GLOBAL ███████░░░░░ 62 % (5/8 protégées)
  📡 F6 balayage (0 crit)   ✈️ F6 décollage   🛡️ F1–F5 ✅  F6 ⧗  F7–F8 ⏳
```

---

## Carte de Fusion (gabarit)

```
╭─ CARTE DE FUSION — Module: <nom> · PR #<n> ───────────────╮
│  Dimension              Verdict                            │
│  Tests (unit+E2E)       ✅ GO                              │
│  Couverture ≥ 80 %      ✅ GO  (87 %)                      │
│  Loi 1 — Red-Team       ✅ GO  (cross-tenant → 404)        │
│  Loi 2 — PostGIS        ✅ GO                              │
│  Loi 3 — RTL logique    ✅ GO                              │
│  OWASP / secrets        ✅ GO                              │
│  Perf                   ✅ GO                              │
│  CI verte               ✅ GO                              │
├────────────────────────────────────────────────────────────┤
│  Verdict global : GO — en attente de « GO #<n> »           │
╰────────────────────────────────────────────────────────────╯
```

Tout `❌` sur une dimension = **no-go** : on corrige, on rejoue RADAR/CHASSEUR, on re-publie la carte.

---

## Règles d'or (non négociables)

1. **Jamais sur `main` direct** — branche dédiée + **worktree isolé** sur `origin/main`.
2. **Attendre le GO** explicite à chaque gate (plan validé, merge) — `Ping.aiff` avant chaque demande.
3. **Les 3 Lois dès le dev** (`company_id`+RLS · PostGIS `::geography` · CSS logique `ms-/me-/ps-/pe-`).
4. **Test après chaque fonction** — pas d'avance tant que `Fi` n'est pas intégrée ET testée.
5. **Expliquer avant de coder** chaque fonction (clair, court).
6. **Red-Team cross-tenant obligatoire** par fonction (≠ `404` = no-go bloquant).
7. **Aucun secret en dur**, `git add` chemins explicites (jamais `-A`), pas de `.env`/`.mcp.json`.
8. **Sons** : `Pop.aiff` fin de phase · `Ping.aiff` avant une demande bloquante · `Hero.aiff` au merge.

## Anti-patterns (refuser)

- Coder avant le GO du découpage · passer à `Fi+1` avec `Fi` non testée/intégrée · sauter le CHASSEUR
  Red-Team · merger sans Carte de Fusion ni « GO #PR » · deux agents sur le même fichier · `git add -A`
  dans la phase de livraison · inventer un % d'avancement (fonction non démarrée = 0 %).
