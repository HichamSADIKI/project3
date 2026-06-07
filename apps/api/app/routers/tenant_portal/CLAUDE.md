# Portail locataire (module `tenant_portal`, pas de migration)

Module `tenant_portal` (`/api/v1/tenant`) **sans table propre** : self-service du locataire connecté, sur le modèle de `client_portal`/`owner_portal`. Garde `require_roles("client", "admin", "manager")` au niveau routeur ; chaque endpoint résout le `tenant_profiles`/`clients.id` du JWT et **scope strictement** ses données (anti-BOLA : un locataire ne voit que SES paiements/tickets/conversations). Agrège en lecture/écriture les modules existants — `payments`, `ticketing`, `comms` — sans dupliquer leur logique.

- **Routes** : `GET /tenant/dashboard` (synthèse) · `GET /tenant/payments` + `POST /tenant/payments/{request_id}/pay` · `GET|POST /tenant/tickets`, `GET /tenant/tickets/{id}`, `POST /tenant/tickets/{id}/comments` · `GET /tenant/chat`, `GET /tenant/chat/{conv_id}`.
- Pas de tâche Celery. **Frontend dans `apps/portal`** (portail public, pas le back-office) : routes `app/[locale]/tenant/{,, chat, payments, tickets}` (dashboard + chat + paiements + tickets) consommant `/api/v1/tenant/**` via le proxy `app/api/proxy/[...path]`. Bundle i18n dédié `packages/i18n/locales/{ar,en,fr}/tenant.json`.
