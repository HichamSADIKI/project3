# Rapport d'audit sécurité — SGI Backoffice

Date : 2026-05-26  
Scope : `apps/web/` (Next.js 16.2 App Router)

---

## Ce qui a été corrigé

### 1. Auth guard côté serveur — `middleware.ts` (CRITIQUE)

**Problème** : `app/page.tsx` est un composant client pur. L'état `screen === "login"` était stocké dans un `useState` React : n'importe quel utilisateur pouvait contourner la page de login en modifiant le state côté client (DevTools, script injecté).

**Correction** : création de `apps/web/middleware.ts`

- S'exécute dans l'**Edge Runtime** de Next.js (avant le rendu de toute page).
- Vérifie la présence du cookie `sgi-session` (httpOnly).
- Si le cookie est présent, **vérifie la signature HMAC-SHA256** via `crypto.subtle` (Web Crypto API, compatible Edge) en utilisant `JWT_SECRET`.
- Si le token est absent, invalide ou expiré → **redirect 307 vers `/`** (écran login).
- Si `JWT_SECRET` n'est pas configuré côté serveur → laisse passer (évite le lockout complet en dev, mais déclenche une erreur 500 à la prochaine tentative de login).

Routes laissées **publiques** sans vérification :
```
/api/auth/login
/api/auth/logout
/_next/*
/public/*
*.ico, *.png, *.svg, *.woff2, ...
```

### 2. `.gitignore` — patterns env manquants (MOYEN)

**Problème** : les patterns `.env*.local` (Create React App / Next.js standard) et les variantes
`.env.development.local`, `.env.test.local`, `.env.production.local` étaient absents du `.gitignore` racine.

**Correction** : ajout dans `/Users/sadiki/Desktop/SGI/SGI_Project/.gitignore` :
```
.env*.local
.env.development.local
.env.test.local
.env.production.local
.env.staging
```

---

## Ce qui reste à faire avant la mise en production

### BLOQUANT — Secret Gemini API key committé dans git

**Fichier concerné** : `.mcp.json` (tracké par git, commit `e7129e8`)

```json
"GEMINI_API_KEY": "AIza…REDACTED"
```

Cette clé était **exposée dans l'historique git**. Actions réalisées :

1. **Révoquée** dans la console Google (clé compromise — remplacée par une nouvelle).
2. Sortie de `.mcp.json` → centralisée dans `.env` (gitignoré) ; le serveur MCP la lit via `node --env-file`.
3. Valeur caviardée ici. (L'ancienne reste dans l'historique git ; sa révocation côté fournisseur la neutralise.)
2. Générer une nouvelle clé.
3. Ajouter `.mcp.json` au `.gitignore` :
   ```
   .mcp.json
   ```
4. Retirer le fichier du tracking git :
   ```bash
   git rm --cached .mcp.json
   git commit -m "chore(security): retirer .mcp.json du tracking git"
   ```
5. **Purger l'historique git** pour effacer la clé des anciens commits :
   ```bash
   # Avec git-filter-repo (recommandé)
   pip install git-filter-repo
   git filter-repo --path .mcp.json --invert-paths
   git push --force-with-lease origin main
   ```
   Attention : cette opération réécrit l'historique. Coordonner avec tous les collaborateurs.

### IMPORTANT — JWT_SECRET

- **Longueur minimum** : 256 bits (32 octets aléatoires en base64) — exemple de génération :
  ```bash
  openssl rand -base64 32
  ```
- **Ne jamais** partager le même `JWT_SECRET` entre les environnements (dev / staging / prod).
- **Rotation** : en cas de suspicion de compromission, changer `JWT_SECRET` invalide immédiatement toutes les sessions actives (comportement voulu — les utilisateurs doivent se reconnecter).
- Rotation planifiée recommandée : tous les 90 jours en production.
- Stocker dans les secrets du CI/CD (GitHub Actions Secrets ou HashiCorp Vault), jamais dans un fichier `.env` commité.

### RECOMMANDÉ — Architecture d'authentification long terme

L'authentification actuelle (`DEMO_LOGIN` / `DEMO_PASSWORD`) est une démo monocompte.
Pour la production avec 50+ agents :

- Migrer vers une authentification multi-utilisateurs (table `users` avec hash bcrypt).
- Envisager un refresh token (cookie httpOnly séparé, durée 30 jours) + access token court (15 min).
- Ajouter un rate-limiting sur `/api/auth/login` (Nginx `limit_req_zone` ou middleware).
- Activer le header `Strict-Transport-Security` (HSTS) dans la config Nginx.

### RECOMMANDÉ — CSRF

Le cookie `sgi-session` est `SameSite=Strict`, ce qui offre une protection CSRF pour les navigateurs modernes. Vérifier que toutes les mutations passent par des requêtes `POST/PUT/DELETE` (pas `GET`).

---

## Récapitulatif des fichiers modifiés / créés

| Fichier | Action | Raison |
|---|---|---|
| `apps/web/middleware.ts` | **Créé** | Auth guard Edge Runtime (JWT HS256) |
| `.gitignore` (racine) | **Modifié** | Ajout patterns `.env*.local` manquants |

## Fichiers NON modifiés (hors scope)

| Fichier | Statut |
|---|---|
| `apps/web/app/page.tsx` | Inchangé — le middleware protège en amont |
| `apps/web/app/screens/*` | Inchangés |
| `.mcp.json` | Non modifié — **action manuelle requise** (voir ci-dessus) |
