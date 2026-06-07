# Mise en place du SSO OAuth (Google · Apple)

Runbook pour activer la connexion sociale du back-office SGI. Le code est déjà en
place (PR #271) ; il ne reste qu'à **fournir les credentials** et à les câbler.

## Modèle de sécurité — *match-only*

La connexion sociale **n'autorise QUE des comptes SGI internes existants et
actifs**, identifiés par leur **email vérifié** par le provider. **Aucune
auto-création** (outil B2B interne).

- Pour qu'un agent puisse se connecter via Google/Apple, **l'email de son compte
  SGI doit être identique** à l'email du provider (vérifié).
- Email inconnu → `403 oauth_no_account`. Email non vérifié → `403`.
- La première connexion sociale **épingle** l'identité (`oauth_provider` +
  `oauth_subject`) au compte ; une connexion ultérieure avec un sujet différent
  pour le même provider est refusée (`403 oauth_subject_mismatch`).

## Flux

```
Bouton login → GET  /api/auth/oauth/{provider}/start      (BFF web : URL d'autorisation + cookie state)
            → provider (consentement)
            → /api/auth/oauth/{provider}/callback          (Google: GET · Apple: POST form_post)
            → POST /api/v1/auth/social {provider, code, redirect_uri}   (API : échange code + vérif id_token JWKS + match compte)
            → cookies de session SGI posés → redirection vers /
```

**Le `client_id`** est nécessaire au **web** (construire l'URL d'autorisation) et
à l'**API** (échange du code). **Le `client_secret` / la clé privée Apple** restent
**exclusivement côté API**.

## Où placer les variables

| Variable | Service `api` (`env_file: .env`) | Service `web` (`environment:`) |
|---|:---:|:---:|
| `GOOGLE_OAUTH_CLIENT_ID` | ✅ | ✅ (via `${GOOGLE_OAUTH_CLIENT_ID}`) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | ✅ | — |
| `APPLE_OAUTH_CLIENT_ID` | ✅ | ✅ |
| `APPLE_OAUTH_TEAM_ID` / `APPLE_OAUTH_KEY_ID` / `APPLE_OAUTH_PRIVATE_KEY` | ✅ | — |

→ **Il suffit de renseigner ces variables dans `.env`** (cf. `.env.example`). Le
service `api` les lit via `env_file`, et `docker-compose.yml` propage les deux
`*_CLIENT_ID` au service `web`. Variables vides ⇒ bouton « non configuré » (501),
aucune régression.

## URIs de redirection (callback)

Le `redirect_uri` est dérivé de l'origine vue par le navigateur :

```
{origine_web}/api/auth/oauth/google/callback
{origine_web}/api/auth/oauth/apple/callback
```

- **Dev** (compose override → web sur `:5050`) : `http://localhost:5050/api/auth/oauth/google/callback`.
  Google autorise `http://localhost` pour les tests. **Apple n'autorise PAS
  `localhost`/`http`** → Apple ne se teste qu'avec un domaine **HTTPS** réel.
- **Prod** : `https://<votre-domaine>/api/auth/oauth/{provider}/callback`.

Déclarez **exactement** ces URIs côté provider (pas de slash final divergent).

## Google — Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services.
2. **OAuth consent screen** : type *Internal* (Workspace) ou *External*, scopes
   `openid`, `email`, `profile`.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorized redirect URIs** : ajoutez les URIs de callback dev + prod ci-dessus.
5. Récupérez **Client ID** et **Client secret** → `.env` :
   ```
   GOOGLE_OAUTH_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxx
   ```

## Apple — Developer

1. [developer.apple.com](https://developer.apple.com) → Certificates, IDs & Profiles.
2. **App ID** avec la capability **Sign in with Apple**.
3. **Services ID** (= `client_id`, ex. `ae.infinity.signin`) → activez *Sign in
   with Apple* → **Return URLs** = l'URI de callback **HTTPS** prod.
4. **Key** : créez une clé *Sign in with Apple* (`.p8`), notez le **Key ID** et le
   **Team ID**.
5. `.env` :
   ```
   APPLE_OAUTH_CLIENT_ID=ae.infinity.signin
   APPLE_OAUTH_TEAM_ID=XXXXXXXXXX
   APPLE_OAUTH_KEY_ID=YYYYYYYYYY
   # contenu PEM de AuthKey_YYYYYYYYYY.p8 (avec \n littéraux ou multi-lignes)
   APPLE_OAUTH_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   ```

## Appliquer

```bash
# après avoir renseigné .env :
docker compose up -d --build web api
```

Vérifier : la page de login affiche les boutons ; un clic sur **Google** redirige
vers l'écran de consentement Google. Après consentement avec un email = un compte
SGI actif, la session est ouverte. Sinon, retour login avec `?sso_error=...`.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Bouton → `?sso_error=google_not_configured` | `GOOGLE_OAUTH_CLIENT_ID` absent côté **web** |
| `redirect_uri_mismatch` (Google) | URI de callback non déclarée à l'identique |
| `?sso_error=google_oauth_no_account` | aucun compte SGI actif pour cet email |
| `?sso_error=apple_state` | cookie `state` perdu (Apple `form_post` exige HTTPS + `SameSite=None`) |
| 501 à l'échange | secret/clé manquant côté **api** (`.env` / `env_file`) |
