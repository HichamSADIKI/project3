# Acquisition de leads — Marketing · Sources · Vitrine publique (migrations 0038–0041)

> Extracted from the root `CLAUDE.md`. Cross-cutting reference for the `marketing` · `sources` · `public_site` modules.

Trois modules ajoutés après l'IAM pour alimenter le CRM en leads (sortant + entrant) et exposer le catalogue au public. Même pattern router/schemas/service/test, filtre `company_id` (Loi 1), helpers purs testés, références auto-générées triables.

| Module / Migration | Route prefix | Tables (RLS) | Notes |
|---|---|---|---|
| `marketing` (0038) | `/marketing` | campagnes + unités liées | **Diffusion sortante** multicanal : campagnes (`/campaigns` CRUD + `/transition` + `/publish`), unités attachées (`…/units`), capture de lead entrant (`…/inbound-lead`), `/kpis`. Helpers : `generate_reference`, `is_valid_channel`, `is_valid_campaign_transition`. **Connecteurs** enfichables dans `connectors/` (`base.py` + `stubs.py` — façades portails/réseaux, à implémenter). |
| `sources` (0039) | `/sources` | registre d'imports | **Ingestion entrante → leads CRM** : imports `POST /imports/{csv,webhook}`, suivi `GET /imports[/{id}]`. **Connecteurs** `connectors/` (`SourceConnector` base + `CsvConnector`, `WebhookConnector`, `ApiStubConnector`). Helpers de dédup/normalisation : `normalize_email`, `normalize_phone`, `compute_dedup_key`, `map_to_lead_payload`, `is_valid_source_type`. Beat : watcher de portails immobiliers (`celery_app.py`). |
| `public_site` (0040–0041) | `/public` | — (lit annonces + users, champs vitrine) | **Vitrine publique sans JWT** (montée à part dans `main.py`) : `GET /public/{listings,listings/{slug},stats,agents,agents/{slug}}` + `POST /public/leads` (capture publique). Migration 0040 ajoute `slug`/`featured`/`urgent` aux annonces, 0041 le profil public agent (`phone/whatsapp/photo/title/bio` sur `users`). `search.py` = couche Meilisearch ; `service.slugify` + presign MinIO des médias. |

**Frontend** : back-office `apps/web` a un screen **Marketing** (`app/screens/realestate-marketing.tsx` + `marketing.tsx`, nav `nav_marketing`). La **vitrine publique** vit dans `apps/portal` (`app/[locale]/{properties,property,agents,agent,contact}`) et consomme `/api/v1/public/**` via le proxy portal. Démo : `PUBLIC_SITE_COMPANY_SLUG` + `scripts/seed_public_demo.py` (voir mémoire projet).
