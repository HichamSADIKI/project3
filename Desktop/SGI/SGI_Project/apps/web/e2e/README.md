# E2E Playwright — smoke du back-office SGI

Suite de **smoke tests** des parcours critiques, exécutés dans un vrai navigateur
contre une stack qui tourne (web + API + DB + MinIO). Verrouille le travail front
(12 modules Immobilier, publication vitrine, générateur de scénarios vidéo) contre
les régressions — au-delà du seul `tsc`.

## Périmètre couvert

| Spec | Parcours |
|---|---|
| `auth.spec.ts` | Login (réel → API → cookie de session → coquille applicative) ; mauvais mot de passe rejeté |
| `immobilier-vente.spec.ts` | Navigation sidebar (groupe + rubrique repliables) → écran Vente ; interrupteur **En ligne/Hors ligne** qui bascule l'état réel via l'API puis le restaure |
| `scenario-video.spec.ts` | Popup du générateur de scénario vidéo : avatars voix **Homme/Femme**, garde-fou « Générer » désactivé à vide |
| `crud-branch.spec.ts` | Création d'une Succursale (formulaire → POST réel → ligne dans la liste) |
| `tenant-isolation.spec.ts` | Loi 1 à la frontière proxy : id forgé → 404 ; sans session → 401 |
| `scenario-watch.spec.ts` | **Lecture vidéo durable (#125/#136)** : l'URL présignée d'un scénario *ready* est re-signée à la lecture, vise l'endpoint public (:9000) et renvoie `200 video/mp4` |

> Note : la **génération** vidéo (Celery + FFmpeg, asynchrone) n'est pas rejouée ici.
> `scenario-watch` valide en revanche la **lecture** de bout en bout (présignature
> à la lecture + joignabilité navigateur), via un scénario seedé.

### Pré-requis seed (`scenario-watch.spec.ts`)

Ce spec exige un scénario *ready* avec un vrai objet MinIO + `video_object_key` :

```bash
docker compose exec -T api uv run python - < apps/api/scripts/seed_ready_scenario_video.py
```

Idempotent (réutilise le scénario s'il existe). Nécessite la migration `0046` appliquée
(`make migrate`) et une annonce vente seedée (`scripts/seed_sale_demo.py`).

## Architecture testée

Le back-office est une **SPA pilotée par état** : un seul route `/`, navigation par
clics sidebar (pas d'URLs par écran). L'app démarre toujours sur l'écran login (pas
de restauration de session) → chaque test passe par le formulaire. Sélecteurs via
`data-testid` (indépendants de la locale AR/EN/FR).

## Lancer

Pré-requis : la stack tourne (`make up`) — API `:8000`, MinIO, DB seedées
(`admin@infinity-uae.com` / `Admin12345!`).

### Contre la stack Docker (web `:5001`)

```bash
# Le web Docker doit être (re)buildé depuis un main qui contient les data-testid.
pnpm --filter sgi-web e2e            # baseURL = http://localhost:5001 par défaut
```

### Contre un serveur local (itération rapide)

Le middleware Edge vérifie la signature JWT → `JWT_SECRET` **doit** valoir le
`SECRET_KEY` du backend. Lancer en mode **production** (`next start`), pas `next dev`
(quirk Turbopack : `cookies()` ne lit pas le cookie httpOnly en dev) :

```bash
pnpm --filter sgi-web build
BACKEND_API_URL=http://localhost:8000 JWT_SECRET=<SECRET_KEY backend> \
  pnpm --filter sgi-web start --port 5199 &
E2E_BASE_URL=http://localhost:5199 pnpm --filter sgi-web e2e
```

## Hors CI

Non branché sur la CI GitHub (qui n'a pas la stack complète API/DB/MinIO). Exécution
locale contre une stack up. Artefacts (`test-results/`, `playwright-report/`) ignorés
par git.
