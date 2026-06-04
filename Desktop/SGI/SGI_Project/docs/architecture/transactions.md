# Transactions immobilières — Achat · Vente · Location (migrations 0033–0035)

> Extracted from the root `CLAUDE.md`. Cross-cutting reference for the `acquisitions` · `sales` · `leasing` modules.

Les trois flux transactionnels du métier agence, ajoutés après le service desk. Même pattern router/schemas/service/test, filtre `company_id` (Loi 1), helpers purs testés, références auto-générées triables. **La référence est générée inline sous verrou consultatif** (`pg_advisory_xact_lock`) plutôt que par retry — le verrou rend l'anti-collision déterministe (cf. commits récents `refactor/immobilier-inline-references`, `fix/reference-race-condition`).

| Module / Migration | Route prefix | Tables (RLS) | Notes |
|---|---|---|---|
| `acquisitions` (0033) | `/acquisitions` | `buyer_mandates`, `purchase_offers` | Mandats d'achat (recherche pour acquéreur) + offres d'achat. Helpers : `generate_reference`, `is_valid_mandate_transition`, `is_valid_offer_transition`, `match_score` (scoring acheteur↔bien, PostGIS pour la proximité), `find_matches`. |
| `sales` (0034) | `/sales` | `sale_mandates`, `sale_listings`, `sale_offers`, `sale_transactions` | Chaîne de vente complète : mandat → annonce → offre → transaction. `compute_commission`, 4 machines à états (`is_valid_{mandate,listing,offer,transaction}_transition`), `create_transaction_from_offer` (une seule transaction *live* par offre — `get_live_transaction_for_offer`). |
| `leasing` (0035) | `/leasing` | `rental_listings`, `rental_applications` | Annonces de location + candidatures locataires. `is_valid_listing_transition`, `is_valid_application_transition`, séquences de référence séparées listing/application. |

**Frontend** (`apps/web`) : 3 screens dédiés — `realestate-achat.tsx` (`ScreenRealEstateAchat`, nav `realestate_achat`), `realestate-vente.tsx` (`ScreenRealEstateVente`, nav `realestate_vente`), `realestate-location.tsx` (`ScreenRealEstateLocation`, nav `realestate_location`). Libellés `nav_achat` / `nav_vente` / `nav_location`.
