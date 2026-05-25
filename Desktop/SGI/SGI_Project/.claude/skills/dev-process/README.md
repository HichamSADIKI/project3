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

---

## Workflow

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
| Partie terminée | `afplay /System/Library/Sounds/Glass.aiff` |
| Livraison finale | `afplay /System/Library/Sounds/Hero.aiff` |

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
