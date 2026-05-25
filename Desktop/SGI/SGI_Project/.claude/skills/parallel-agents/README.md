# Skill : parallel-agents v1
# Orchestration multi-agents en parallèle — SGI

## Quand charger

Charger pour toute demande qui couvre **2 dimensions ou plus** parmi :
- Analyse / exploration de code
- Développement (nouveau module, refactoring)
- Tests fonctionnels
- Audit sécurité / i18n / performance
- Validation TypeScript + lint
- Intégration GitHub (PR, commit, review)

Ne pas charger pour : tâche unique ciblée (un fichier, un bug isolé).

---

## Philosophie — Parallélisme maximal, coordination minimale

**Les agents sont des collègues spécialisés. Chacun travaille de son côté, rend son résultat, tu synthétises.**

- Lancer N agents en un seul message (un bloc `<function_calls>` avec N appels Agent)
- Chaque agent reçoit un prompt autonome : il ne dépend pas des autres
- Utiliser `isolation: "worktree"` quand l'agent modifie des fichiers
- Les agents foreground bloquent : réserver au résultat nécessaire pour la suite
- Les agents background libèrent le fil : utiliser pour tâches indépendantes longues
- Synthétiser tous les résultats avant de présenter à l'utilisateur

---

## Pipeline complet SGI — 6 phases parallélisables

```
Phase 1 : ANALYSE (Explore agent)
Phase 2 : DÉVELOPPEMENT (claude agent × N modules) ← en parallèle
Phase 3 : TESTS FONCTIONNELS (general-purpose agent)
Phase 4 : AUDIT (sécurité + i18n + perf) ← 3 agents en parallèle
Phase 5 : VALIDATION (TypeScript + lint + build)
Phase 6 : INTÉGRATION GITHUB (commit + PR)
```

Phases 2, 3, 4 sont parallélisables entre elles selon les dépendances.

---

## Phase 1 — ANALYSE (Explore agent)

```
Agent(Explore, "Audit le codebase pour X. Breadth: thorough. Ne modifie rien.")
```

Toujours lancer en foreground : le plan de développement dépend des résultats.

**Ce que l'agent Explore doit rapporter :**
- Fichiers affectés et leurs patterns actuels
- Dépendances entre fichiers
- Conventions utilisées (composants existants, naming, types)
- Points d'intégration (imports, exports, props partagées)
- Risques (breaking changes potentiels)

---

## Phase 2 — DÉVELOPPEMENT PARALLÈLE

Quand plusieurs modules sont indépendants, les développer en parallèle :

```python
# Un seul message, N agents avec worktree isolation
Agent(worktree, "Créer screen A — [instructions détaillées]")
Agent(worktree, "Créer screen B — [instructions détaillées]")
Agent(worktree, "Mettre à jour i18n.ts avec les nouvelles clés — [liste exacte]")
```

**Règles de segmentation :**
- Un agent = un fichier ou un groupe de fichiers sans intersection
- Si deux agents modifient le même fichier → séquentiel obligatoire
- Toujours inclure dans le prompt : fichiers à lire, fichiers à modifier, TypeScript check à la fin
- Préciser les patterns existants dans chaque prompt (l'agent ne voit pas la conversation)

**Template de prompt pour un agent développeur :**
```
Contexte : projet SGI à /Users/sadiki/Desktop/SGI/SGI_Project/apps/web
Tu travailles sur [MODULE].

Lire d'abord : [liste des fichiers à lire]
Pattern existant : [code snippet ou description précise]

Tâche : [description détaillée]
Fichiers à modifier : [liste]
Fichiers à créer : [liste avec chemin complet]

Contraintes :
- CSS logique uniquement (ms-/me-/ps-/pe-)
- Trilingue AR/EN/FR via colLabel(en, ar, fr)
- TypeScript strict — npx tsc --noEmit à la fin (0 erreur obligatoire)
- Ne pas modifier d'autres fichiers
```

---

## Phase 3 — TESTS FONCTIONNELS (agent dédié)

Lancer en parallèle avec la phase 4 si le dev est terminé.

```python
Agent(general-purpose, """
Audit fonctionnel statique de [FICHIERS].
Pour chaque fonction interactive : handler présent ? state correct ? cas limites ?
Rapport dans FUNCTIONAL_TEST_REPORT.md.
Severities : CRITICAL | HIGH | MEDIUM | LOW
Ne pas modifier le code.
""")
```

**Checklist fonctionnelle standard SGI :**
- [ ] Boutons avec onClick manquant
- [ ] Filtres avec logique incorrecte
- [ ] Wallet : balance guard avant déduction
- [ ] DealWizard : validation des champs obligatoires
- [ ] Navigation : NavKeys sans screen correspondant
- [ ] Forms : soumission sans handler
- [ ] State : initialisation correcte, pas de mutation directe

---

## Phase 4 — AUDIT PARALLÈLE (3 agents simultanés)

```python
# Lancer les 3 en un seul message
Agent(Explore, "Audit i18n — chaînes codées en dur sans traduction AR/EN/FR")
Agent(Explore, "Audit sécurité — auth guard, secrets, XSS, localStorage")
Agent(Explore, "Audit performance — N+1, composants sans memo, re-renders")
```

### Audit i18n
- Chaînes en dur en une seule langue
- `useT()` / `colLabel()` manquants
- Clés manquantes dans `lib/i18n.ts` pour AR/EN/FR
- RTL : CSS physique au lieu de logique

### Audit sécurité
- Middleware auth absent ou incomplet
- Secrets dans le code (pas dans `.env`)
- `.gitignore` incomplet (`.env`, `.env.local`, `.mcp.json`)
- `dangerouslySetInnerHTML` sans sanitization
- JWT : nom du cookie, expiry, HMAC vs RS256

### Audit performance
- Composants qui re-rendent sans raison (pas de `useMemo` / `useCallback`)
- Images sans `width`/`height` (layout shift)
- Listes sans clé stable (`key={index}` au lieu de `key={item.id}`)
- `useEffect` avec dépendances manquantes

---

## Phase 5 — VALIDATION

Lancer en séquentiel (chacun dépend du précédent) :

```bash
# TypeScript strict
cd /Users/sadiki/Desktop/SGI/SGI_Project/apps/web && npx tsc --noEmit 2>&1

# Lint (si disponible)
make lint 2>&1 || echo "lint not configured"

# Build check
pnpm build 2>&1 | tail -20
```

**Règle : 0 erreur TypeScript avant tout commit. Toujours.**

---

## Phase 6 — INTÉGRATION GITHUB

### Commit structuré

Format des messages (convention SGI) :
```
type(module): description courte en français

- bullet 1 : détail
- bullet 2 : détail

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types valides : `feat · fix · test · docs · chore · refactor · perf · ci`

Exemple : `feat(marketing): ajouter screen campagnes avec KPIs trilingues`

### Checklist pré-commit

```bash
# 1. Vérifier les fichiers sensibles
git diff --name-only | grep -E "\.env|\.mcp\.json|secrets"

# 2. TypeScript
npx tsc --noEmit

# 3. Status
git status

# 4. Diff final
git diff --staged
```

**Ne jamais committer :**
- `.env`, `.env.local`, `.env*.local`
- `.mcp.json` (contient des API keys)
- Fichiers avec `console.log` de debug
- Fichiers avec credentials en dur

### Pull Request

Template standard SGI :
```markdown
## Résumé
- [bullet 1]
- [bullet 2]

## Modules affectés
- `apps/web/app/screens/[module]`
- `apps/web/components/`

## Vérifications
- [ ] TypeScript 0 erreur
- [ ] Trilingue AR/EN/FR
- [ ] CSS logique (pas de ml-/mr-)
- [ ] Pas de secrets commités
- [ ] Fonctions interactives testées

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Patterns de coordination

### Résultats des agents worktree

Les agents en `isolation: "worktree"` opèrent sur une branche temporaire.
Après réception des résultats, appliquer manuellement les changements depuis le rapport ou
demander à l'agent de fournir les diffs exacts.

### Synthèse multi-agents

Après réception de N résultats parallèles :
1. Identifier les conflits (deux agents ont modifié le même concept différemment)
2. Prioriser par sévérité (CRITICAL > HIGH > MEDIUM > LOW)
3. Appliquer dans l'ordre : corrections bloquantes → améliorations → style
4. Relancer un agent de validation pour vérifier la cohérence

### Dépendances entre agents

```
i18n.ts modifié → tous les screens qui l'importent doivent être revalidés
sgi-ui.tsx modifié (NavKey) → page.tsx doit être mis à jour
deal-wizard.tsx modifié (ConfirmedDeal type) → clients-personne + clients-societe + sector-crm
auth.ts modifié → middleware.ts + api/auth/* doivent être cohérents
```

---

## Exemples d'invocations

### Nouveau module complet

```python
# Phase 1 : analyse (foreground)
Agent(Explore, "Explorer le pattern screen SGI existant — lire dashboard.tsx, marketing.tsx, travail.tsx. Rapporter : structure type, composants réutilisés, pattern i18n, pattern data.")

# Phase 2 : dev parallèle (après analyse)
Agent(worktree, "Créer screen [MODULE] selon pattern SGI [...]")
Agent(worktree, "Ajouter clés i18n AR/EN/FR pour [MODULE] dans lib/i18n.ts [...]")
Agent(worktree, "Ajouter NavKey + icône dans sgi-ui.tsx + route dans page.tsx [...]")

# Phase 3+4 : tests + audit en parallèle
Agent(general-purpose, "Test fonctionnel statique de [MODULE].tsx [...]")
Agent(Explore, "Audit i18n de [MODULE].tsx [...]")
```

### Audit + correction

```python
# Audit parallèle (foreground tous)
Agent(Explore, "Audit sécurité")
Agent(Explore, "Audit i18n")
Agent(Explore, "Audit fonctionnel")

# Correction après synthèse
Agent(worktree, "Corriger les 4 HIGH issues trouvées : [liste exacte avec fichier:ligne]")
```

### Release GitHub

```bash
# Validation finale
npx tsc --noEmit && make lint

# Commit groupé
git add apps/web/app/screens/marketing.tsx apps/web/lib/i18n.ts apps/web/components/sgi-ui.tsx
git commit -m "feat(marketing): ajouter module campagnes trilingue AR/EN/FR"

# PR
gh pr create --title "feat: module Marketing + audit i18n/sécurité" --body "$(cat <<'EOF'
## Résumé
- Nouveau screen Marketing avec KPIs, filtres, tableau campagnes
- Traductions complètes AR/EN/FR (hero login, sector-crm, marketing)
- Middleware auth guard JWT côté serveur
- Audit fonctionnel : 41 issues identifiées (rapport dans FUNCTIONAL_TEST_REPORT.md)

## Vérifications
- [x] TypeScript 0 erreur
- [x] Trilingue AR/EN/FR
- [x] CSS logique
- [x] Middleware auth ajouté

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Anti-patterns

| Interdit | Raison |
|---|---|
| Spawner un agent pour une tâche de 2 lignes | Overhead > gain |
| Deux agents qui modifient le même fichier en parallèle | Merge conflict garanti |
| Prompt sans contexte codebase | L'agent repart de zéro, résultat générique |
| Oublier `isolation: "worktree"` pour les agents qui écrivent | Pollue le working tree |
| Committer sans tsc --noEmit | Erreurs TypeScript en production |
| Committer `.mcp.json` ou `.env` | Fuite de secrets (GEMINI_API_KEY, JWT_SECRET) |
| Agent background pour une tâche dont tu as besoin immédiatement | Deadlock de travail |
| Synthèse sans vérification des conflits entre agents | Résultats incohérents |
