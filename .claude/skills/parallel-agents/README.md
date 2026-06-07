# Skill : parallel-agents v2
# Orchestration multi-agents en parallèle — SGI

## Quand charger

Charger pour toute demande qui couvre **1 dimension ou plus** parmi :
- Développement (nouveau module, refactoring, nouvelle fonctionnalité)
- Correction de bugs multiples
- Tests fonctionnels
- Audit sécurité / i18n / performance
- Validation TypeScript + lint
- Intégration GitHub (commit, push, PR)

Ne pas charger pour : question simple, changement de texte isolé, 1 seul fichier évident.

---

## Philosophie v2 — Équipe spécialisée, validation obligatoire, son de fin

**Chaque tâche utilisateur déclenche une équipe d'agents spécialisés :**

1. **N agents développeurs** travaillent en parallèle sur des modules non-chevauchants
2. **1 agent validateur** vérifie le travail de tous les autres APRÈS leur terminaison
3. **1 agent de test** valide les fonctionnalités via Playwright
4. **1 agent d'audit sécurité** vérifie les implications sécuritaires
5. **Son de fin** → `afplay /System/Library/Sounds/Hero.aiff` à la toute fin

**Règle d'or : aucun commit sans validation du validateur. Aucune livraison sans son.**

---

## Pipeline standard — 4 phases

```
Phase 1 : ANALYSE rapide (optionnelle, foreground, < 2 min)
          └─ Lire les fichiers cibles, identifier les patterns, briefer les agents dev

Phase 2 : DÉVELOPPEMENT PARALLÈLE (background, N agents simultanés)
          ├─ Agent Dev-A : module / fichier A
          ├─ Agent Dev-B : module / fichier B
          └─ Agent Dev-N : ...

Phase 3 : VALIDATION + TESTS + AUDIT (après phase 2, en parallèle)
          ├─ Agent Validateur : vérifie le travail des agents dev (TypeScript, cohérence, RTL, i18n)
          ├─ Agent Test : teste les fonctionnalités via Playwright Python (http://localhost:3000)
          └─ Agent Audit sécurité : vérifie les implications sécuritaires des changements

Phase 4 : LIVRAISON
          ├─ Corriger les erreurs signalées par le validateur
          ├─ git add + commit + push
          └─ afplay /System/Library/Sounds/Hero.aiff
```

---

## Phase 1 — ANALYSE (optionnelle)

Lancer seulement si la tâche est complexe ou les fichiers cibles inconnus.

```python
Agent(Explore, """
Analyse rapide pour [TÂCHE]. Breadth: medium.
Lire : [fichiers probables]
Rapporter en < 200 mots :
- Fichiers à modifier et leurs patterns actuels
- Composants/types réutilisables
- Risques de breaking changes
- Conventions (CSS logique, i18n, TypeScript)
Ne pas modifier de fichier.
""")
```

---

## Phase 2 — DÉVELOPPEMENT PARALLÈLE

### Règles de segmentation des agents
- **1 agent = 1 fichier ou 1 groupe de fichiers sans intersection**
- Si deux agents touchent le même fichier → **séquentiel obligatoire**
- Chaque agent reçoit un prompt autonome (il ne voit pas la conversation)
- Toujours inclure dans chaque prompt : fichiers à lire, fichiers à modifier, TypeScript check

### Template de prompt agent développeur
```
Tu travailles sur le projet SGI — /Users/sadiki/Documents/Projects/SGI/apps/web

MODULE : [nom du module]
TÂCHE : [description précise de ce que tu dois faire]

LIRE D'ABORD (en parallèle) :
- [fichier 1] — [pourquoi]
- [fichier 2] — [pourquoi]

PATTERN EXISTANT : [snippet ou description précise]

FICHIERS À MODIFIER : [liste avec chemins complets]
FICHIERS À CRÉER : [liste avec chemins complets]

CONTRAINTES ABSOLUES :
- CSS logique : ms-/me-/ps-/pe-/start-/end- (jamais ml-/mr-/pl-/pr-)
- Trilingue : toutes les chaînes via useT() ou colLabel(en, ar, fr)
- TypeScript strict : npx tsc --noEmit à la fin, 0 erreur obligatoire
- "use client" uniquement si hooks React ou event handlers
- Ne modifier AUCUN autre fichier que ceux listés

RAPPORT FINAL :
- Liste des fichiers modifiés/créés
- Résultat TypeScript (0 erreur)
- Description des changements en 5 bullets max
```

### Invocation parallèle (un seul message, N Agent calls)
```python
Agent(background=True, "Dev-A : [MODULE A] — [prompt complet]")
Agent(background=True, "Dev-B : [MODULE B] — [prompt complet]")
Agent(background=True, "Dev-C : [MODULE C] — [prompt complet]")
# Attendre les 3 notifications de complétion avant Phase 3
```

---

## Phase 3 — VALIDATION + TESTS + AUDIT (parallèle)

Lancer les 3 agents **en même temps** dès que tous les agents dev ont terminé.

### Agent Validateur (OBLIGATOIRE)

```
Tu es un agent de validation sur le projet SGI.
Les agents suivants ont modifié du code : [liste des agents avec leurs fichiers].

VALIDE CHAQUE FICHIER MODIFIÉ :
1. TypeScript : cd /Users/sadiki/Documents/Projects/SGI/apps/web && npx tsc --noEmit
2. CSS logique : grep -n "ml-\|mr-\|pl-\|pr-\|left-\|right-" [fichiers] — doit être vide
3. i18n : toutes les chaînes visibles utilisent useT() ou colLabel() ?
4. NavKeys : toute nouvelle route a une entrée dans page.tsx ?
5. Imports : pas d'import inutilisé ou manquant ?
6. RTL : direction: dir ou isAr utilisé si texte affiché ?

RAPPORT (format strict) :
- ✅ [fichier] — OK
- ❌ [fichier] — [problème exact ligne X] — [correction recommandée]

Si des erreurs sont trouvées, les corriger directement (tu peux modifier les fichiers).
Terminer par : TypeScript final 0 erreur confirmé.
```

### Agent Test Navigateur (Playwright Python)

```python
"""
Tests fonctionnels de [FONCTIONNALITÉ] sur http://localhost:3000
Login : input[0] = "login", input[type=password] = "password", clic "Continue to workspace"

Tester :
1. [Fonctionnalité 1] — navigation vers [écran], vérifier [élément visible]
2. [Fonctionnalité 2] — action [clic sur X], vérifier [résultat attendu]
3. Pas de régression : [écrans adjacents] toujours fonctionnels

Pour chaque test :
- page.screenshot(path="/tmp/test_[nom].png")
- Lire le screenshot avec Read tool et décrire ce que tu vois

Rapport : ✅ OK ou ❌ FAIL avec description.
"""
```

### Agent Audit Sécurité (ciblé sur les changements)

```
Audit sécurité ciblé sur les fichiers modifiés : [liste]

Vérifier uniquement :
1. Nouveaux inputs utilisateur → validés/sanitisés ?
2. Nouveaux liens href → pas d'injection possible (target="_blank" + rel="noopener") ?
3. Nouvelles API calls → token auth présent ?
4. Nouveaux cookies/localStorage → httpOnly, pas de PII en clair ?
5. Nouvelles variables d'env → dans .env, pas hardcodées ?

Rapport : CRITIQUE / ÉLEVÉ / MOYEN / INFO
Corriger directement les issues CRITIQUE et ÉLEVÉ.
```

---

## Phase 4 — LIVRAISON

```bash
# 1. Appliquer les corrections du validateur (si non auto-corrigées)

# 2. TypeScript final
npx tsc --noEmit

# 3. Commit
git add [fichiers modifiés — jamais git add -A]
git commit -m "type(module): description en français

- bullet 1
- bullet 2

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# 4. Push
git push origin main

# 5. Son de fin — OBLIGATOIRE
afplay /System/Library/Sounds/Hero.aiff
```

---

## Exemple complet — Nouvelle fonctionnalité

Utilisateur : "Ajoute les boutons WhatsApp/tel/email sur les fiches client"

```python
# Phase 1 — analyse rapide (1 min)
# Lire clients-personne.tsx + clients-societe.tsx → identifier les zones à modifier

# Phase 2 — dev parallèle
Agent(background=True, """Dev clients-personne : ajouter ContactBtn + 4 boutons
  dans /apps/web/app/screens/clients-personne.tsx...""")
Agent(background=True, """Dev clients-societe : ajouter ContactBtn + 4 boutons
  dans /apps/web/app/screens/clients-societe.tsx...""")

# [Attendre les 2 notifications]

# Phase 3 — validation + test + audit (en parallèle)
Agent(background=True, "Validateur : vérifier clients-personne.tsx et clients-societe.tsx...")
Agent(background=True, "Tests Playwright : tester les boutons sur http://localhost:3000...")
Agent(background=True, "Audit sécurité : liens tel:/wa.me/mailto: correctement formés ?...")

# [Attendre les 3 notifications]

# Phase 4 — livraison
# git add + commit + push + Hero.aiff
```

---

## Règles d'invocation

### Quand lancer en background vs foreground

| Situation | Mode |
|---|---|
| Résultat nécessaire avant de continuer (analyse) | foreground |
| Dev indépendant, test, audit | background |
| Validateur (dépend des dev) | background (après attente dev) |
| Tâche < 30s que tu peux faire toi-même | Ne pas spawner |

### Ordre de priorité des corrections

```
CRITIQUE (sécurité, crash) → corriger immédiatement, re-lancer le validateur
ÉLEVÉ (bug fonctionnel, TypeScript error) → corriger avant commit
MOYEN (i18n manquant, CSS physique) → corriger si < 5 min, sinon noter
BAS (style, commentaire) → ignorer
```

---

## Son de progression

| Moment | Commande |
|---|---|
| Partie dev terminée | `afplay /System/Library/Sounds/Glass.aiff` |
| Validation OK | `afplay /System/Library/Sounds/Glass.aiff` |
| **Livraison finale complète** | `afplay /System/Library/Sounds/Hero.aiff` |

**Le son Hero.aiff est OBLIGATOIRE à la fin de chaque livraison complète.**

---

## Anti-patterns

| Interdit | Raison |
|---|---|
| Livrer sans phase de validation | Bugs et régressions en prod |
| Deux agents sur le même fichier en parallèle | Merge conflict garanti |
| Prompt sans contexte codebase | Résultat générique inutile |
| Committer sans tsc --noEmit | Erreurs TypeScript silencieuses |
| Committer `.mcp.json` ou `.env` | Fuite de clés API (Gemini, JWT) |
| Oublier le son de fin | Pas de signal de complétion clair |
| Agent background pour résultat immédiat | Deadlock de travail |
| `git add -A` ou `git add .` | Risque de committer des secrets |
| Synthèse sans vérifier les conflits entre agents | Incohérences silencieuses |

---

## Checklist finale (avant chaque livraison)

```
[ ] TypeScript : 0 erreur
[ ] Validateur : tous les fichiers ✅
[ ] Tests : fonctionnalités clés ✅
[ ] Audit : aucun CRITIQUE ou ÉLEVÉ non résolu
[ ] git status : aucun fichier sensible (.env, .mcp.json)
[ ] Commit message : format type(module): description français
[ ] Push : origin/main à jour
[ ] Son : Hero.aiff joué
```
