# Agent AI — Clients & Fournisseurs

Sous-catégorie **« Agent AI »** des espaces **Clients** et **Fournisseurs** du
back-office : analyser → rédiger (éditable) → **envoyer** (email réel) → **agir**
(actions cliquables). Symétrique des deux côtés, scopé tenant (Loi 1), tracé
(`audit_logs`) et conforme **PDPL**.

> Moteur : `app/core/gemini.py` (Gemini 2.5 Flash via `GEMINI_API_KEY`) avec
> **repli heuristique déterministe** AR/EN/FR — tout fonctionne sans clé.

## Endpoints (scopés `company_id`, RBAC `admin/manager/agent`, 404 anti-BOLA)

### Clients — `app/routers/clients/ai_router.py` (`/api/v1/clients/ai`)
- `POST /insights` — synthèse du portefeuille (segmentation, budget, Golden Visa).
- `POST /{client_id}/score` — qualification 0-100 + bande `hot/warm/cold` + éligibilité Golden Visa + actions recommandées.
- `POST /{client_id}/message` — brouillon email/WhatsApp (objets `follow_up/proposal/welcome/visit`).
- `POST /{client_id}/message/send` — **envoi réel** (voir « Canaux »).
- `POST /chat` — copilote conversationnel scopé portefeuille.

### Fournisseurs — `app/routers/vendors/ai_router.py` (`/api/v1/vendors/ai`)
- `POST /insights` — synthèse du parc.
- `POST /{party_id}/risk` — score de fiabilité 0-100 + bande `low/medium/high` + drapeaux (licence/assurance/annulations…).
- `POST /{party_id}/validation` — aide à la validation d'inscription (`approve/request_documents/review/reject`).
- `POST /{party_id}/message` + `/message/send` — outreach (objets `request_documents/performance_review/welcome/follow_up`).
- `POST /chat` — copilote scopé parc.

Logique métier en **helpers purs** (`score_client`, `assess_vendor_risk`,
`validation_assessment`, `portfolio_insights`, `parc_insights`, `draft_message`,
`draft_vendor_message`) — testables sans DB ; base du repli sans IA.

## Canaux d'envoi (C1 / parité)
- **Email** : texte libre → `Notification` (channel=email, pending) + `send_email` (Celery). Destinataire = `Client.email` (pour un fournisseur, l'email de sa **party**). Statut `queued`.
- **WhatsApp** : **non** en texte libre — Meta impose un **template approuvé** (`send_whatsapp_template`). L'endpoint renvoie `template_required` (aucun envoi simulé). → incrément futur : mapping template + variables.
- Pas de coordonnée → `no_recipient`.

## Garde PDPL — `app/core/pdpl.py`
Source unique du denylist (`pdpl_safe`) : Emirates ID, IBAN, PDC, passeport, IBAN,
IDs… ne sont **jamais** transmis à Gemini. Appliqué à tout dict injecté dans un
prompt (insights, chat) côté clients **et** vendors.

## Audit
L'envoi (`POST …/message/send`) est journalisé **automatiquement** par
`AuditMiddleware` (`audit_logs` : action=`send`, resource, resource_id, auteur, IP).

## Frontend (`apps/web`)
- Nav : entrées `clients_ai` / `fournisseurs_ai` (i18n AR/EN/FR), écrans `clients-ai.tsx` / `fournisseurs-ai.tsx`.
- Panneau réutilisable `components/agent-ai-panel.tsx` (onglets Synthèse · Qualification/Risque · Validation · Message · Chat) — **CSS logique RTL** (Loi 3).
  - **Brouillon éditable** (textarea) avant envoi — *humain dans la boucle*.
  - **Actions recommandées cliquables** → navigation (`schedule_visit`→agenda, `propose_golden_visa`→Golden Visa, `follow_up`→CRM, fournisseurs→validation/fiches).
  - **Sélecteur d'entité** `components/entity-search-input.tsx` (recherche par nom via `/api/admin/clients?q=`) au lieu d'un UUID.
  - Libellés métier localisés via la table `tok()`.
- Proxies : `app/api/admin/{clients,vendors}/ai/*` (JWT en cookie httpOnly).

## Tests
- Backend : `test_clients_ai.py` / `test_vendors_ai.py` — helpers purs + intégration HTTP + **Red-Team cross-tenant** (404) + PDPL. Couverture ≈ 96 %.
- Frontend : `tsc` + `vitest` ; E2E Playwright (`e2e/agent-ai.spec.ts`) — smoke nav + UI.

## Limites connues / pistes
- WhatsApp texte libre (→ template approuvé Meta).
- Picker fournisseur basé sur la party (client) ; un picker scopé vendors par nom = incrément backend.
- IA embarquée dans les fiches existantes.
