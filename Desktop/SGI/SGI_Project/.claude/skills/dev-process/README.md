# Skill : dev-process
# Processus de développement structuré — SGI

## Quand charger ce skill

Charge ce skill pour **toute nouvelle demande complexe** : nouvelle fonctionnalité, nouveau module, refactoring majeur, intégration d'API, changement d'architecture.

Ne pas charger pour : corrections de bugs simples, ajustements de style, modifications de texte.

---

## Règle absolue

**Ne jamais coder sans avoir obtenu la confirmation explicite du client à chaque étape.**
Chaque phase se termine par une question de validation. Le développement ne commence qu'après accord.

---

## Phase 1 — Compréhension de la demande

### 1.1 Questions générales

Poser d'abord 3 à 5 questions larges pour cerner la demande :

- Quel est le besoin métier derrière cette fonctionnalité ?
- Qui sont les utilisateurs concernés (agents, managers, legal, clients) ?
- Y a-t-il des contraintes de délai ou de priorité ?
- Existe-t-il déjà quelque chose de similaire dans l'application ?
- Quels sont les critères de succès (comment savoir que c'est réussi) ?

### 1.2 Décorticage en sous-questions

Décomposer la demande en blocs indépendants pour réduire la complexité :

```
Demande principale
├── Sous-question 1 : données et modèles impactés
├── Sous-question 2 : composants UI concernés
├── Sous-question 3 : logique backend (API / service)
├── Sous-question 4 : règles métier spécifiques SGI
├── Sous-question 5 : impact multi-tenant, RTL, i18n
└── Sous-question 6 : tests et sécurité
```

### 1.3 Proposition de solution

Présenter :
- L'approche choisie et pourquoi
- Les alternatives écartées et pourquoi
- Les risques identifiés

### 1.4 Plan d'actions détaillé

Lister chaque étape avec : fichier(s) impacté(s) · durée estimée · dépendances.

```
Étape 1 : [description]  → fichier(s) : X, Y
Étape 2 : [description]  → fichier(s) : Z
...
```

> **→ CONFIRMATION REQUISE** : "Ce plan vous convient-il ? Je commence dès votre accord."

---

## Phase 2 — Développement

Implémenter étape par étape selon le plan validé.

Règles pendant le développement :
- Respecter les 3 lois architecturales (multi-tenant, PostGIS, RTL) du CLAUDE.md
- TypeScript strict : aucun `any` non documenté
- Aucun `"use client"` inutile
- Commits en français : `feat(module): description`

À la fin du développement :

```bash
npx tsc --noEmit   # Vérification TypeScript
make lint          # ESLint + Ruff
```

> **→ CONFIRMATION REQUISE** : "Développement terminé. Voici ce qui a été créé : [résumé]. Puis-je lancer le déploiement ?"

Jouer le son de fin d'étape :
```bash
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 3 — Déploiement

Selon l'environnement :

```bash
# Frontend
pnpm build --filter=web      # Build de production
pnpm dev --filter=web        # Vérification locale port 3000

# Backend (si impacté)
make migrate                 # Migrations Alembic
make up                      # Restart containers
make healthcheck             # Vérification santé

# Si nouveau module backend
make scale n=5               # Vérification scalabilité
```

> **→ CONFIRMATION REQUISE** : "Déploiement effectué. L'application est accessible. Puis-je lancer les tests ?"

Jouer le son de fin d'étape :
```bash
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 4 — Tests

### Tests automatisés

```bash
make test                    # Suite complète
pnpm vitest run              # Tests unitaires frontend
pytest tests/routers/test_{module}.py   # Module backend ciblé
pnpm playwright test         # Tests E2E
```

### Tests manuels (golden path)

Vérifier dans l'ordre :
1. Fonctionnement nominal (cas principal)
2. Cas limites (données vides, valeurs max, champs optionnels)
3. Changement de langue AR → EN → FR (pas de mélange)
4. Mode RTL (Arabic) — layout correct, pas de propriétés physiques CSS
5. Isolation multi-tenant (company_id filtré partout)
6. Responsive (si applicable)

Couverture minimale requise : **≥ 80% sur la logique métier** (sinon PR bloquée).

> **→ CONFIRMATION REQUISE** : "Tests passés : [X/X]. Rapport : [résumé]. Puis-je procéder à l'audit sécurité ?"

Jouer le son de fin d'étape :
```bash
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 5 — Audit sécurité

Vérifier systématiquement :

### Multi-tenant
- [ ] Toutes les requêtes filtrent par `company_id`
- [ ] RLS activé sur les nouvelles tables
- [ ] JWT middleware injecte bien `company_id`

### Injections
- [ ] Aucune interpolation de chaîne dans les requêtes SQL
- [ ] Paramètres Pydantic v2 validés à l'entrée
- [ ] Aucun `eval()` côté frontend

### Données sensibles
- [ ] Aucun secret hardcodé (`os.getenv()` uniquement)
- [ ] Aucune clé API dans le code ou les commits
- [ ] `.env` listé dans `.gitignore`

### Authentification
- [ ] Routes protégées par JWT
- [ ] Expiration des tokens gérée
- [ ] Pas d'accès non authentifié aux ressources privées

### Frontend
- [ ] Aucun XSS possible (pas de `dangerouslySetInnerHTML` non sanitisé)
- [ ] `"use client"` uniquement là où nécessaire
- [ ] Données utilisateur jamais exposées côté serveur sans filtre

> **→ CONFIRMATION REQUISE** : "Audit sécurité complété. Points vérifiés : [liste]. [Alertes éventuelles]. Puis-je valider la fonctionnalité ?"

Jouer le son de fin d'étape :
```bash
afplay /System/Library/Sounds/Glass.aiff
```

---

## Phase 6 — Validation finale

Résumé complet de la livraison :

```
✅ Fonctionnalité : [nom]
✅ Fichiers modifiés : [liste]
✅ Tests : [X passés / X total]
✅ Couverture : [X%]
✅ Audit sécurité : [OK / points à surveiller]
✅ Déploiement : [environnement]
✅ Commit : [hash ou référence]
```

Signaler tout point d'attention pour la suite (dette technique, améliorations futures possibles, edge cases connus).

Jouer le son de validation finale :
```bash
afplay /System/Library/Sounds/Hero.aiff
```

---

## Récapitulatif des sons

| Étape terminée | Commande |
|---|---|
| Développement | `afplay /System/Library/Sounds/Glass.aiff` |
| Déploiement | `afplay /System/Library/Sounds/Glass.aiff` |
| Tests | `afplay /System/Library/Sounds/Glass.aiff` |
| Audit sécurité | `afplay /System/Library/Sounds/Glass.aiff` |
| Validation finale | `afplay /System/Library/Sounds/Hero.aiff` |

---

## Anti-patterns à éviter

- Coder sans avoir posé de questions et reçu une confirmation
- Sauter une phase sous prétexte de rapidité
- Marquer une phase "terminée" sans avoir joué le son
- Proposer un plan et commencer à coder dans le même message
- Committer avec des secrets ou des `console.log` de debug
