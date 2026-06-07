# UAE Infinity PASS (« Infinity ID ») — identité & signature maison

> Solution **interne** d'Infinity, **inspirée du modèle/architecture UAE PASS** (le
> *principe* : niveaux d'assurance, IdP central, signature qualifiée, identité
> stable, step‑up). **≠ UAE PASS gouvernemental** : aucune fédération à
> `id.uaepass.ae`. Infinity **opère son propre** Identity Provider.
> Document d'architecture vivant. Brique 1 (niveaux d'assurance) livrée.

## Principe repris d'UAE PASS (et transposé chez nous)

| Principe UAE PASS | Transposition « Infinity ID » |
|---|---|
| Niveaux SOP1/2/3 | **Niveaux d'assurance L0/L1/L2/L3** (`core/assurance.py`) |
| IdP national (OIDC) | **IdP/SSO interne** unifiant back‑office + 3 portails + mobile |
| Attributs vérifiés par l'État | Attributs **vérifiés par notre KYC** (`tenant_kyc`) |
| Signature qualifiée (QES) | **Signature qualifiée maison** (hash + horodatage + identité L2/L3) |
| `uuid` stable pour le linking | **Identité Infinity stable** reliant la personne dans l'écosystème |
| Step‑up `acr` | **Step‑up** par niveau d'assurance sur actions sensibles |

## Échelle d'assurance (Brique 1 — livrée)

| Niveau | Vérifié | Débloque (≈ équivalent SOP) |
|---|---|---|
| **L0** | rien de prouvé | — |
| **L1** | e‑mail + mobile | login, portail (≈ SOP1) |
| **L2** | + Emirates ID | **signature avancée**, Golden Visa (≈ SOP2) |
| **L3** | + contrôle renforcé (biométrie/liveness) | **signature qualifiée**, IBAN propriétaire, validation paiement (≈ SOP3) |

Matrice **action → niveau minimum** centralisée (`ACTION_MIN_LEVEL`) — c'est la
politique d'accès *par preuve d'identité*, **complémentaire au RBAC** (`iam`, qui
dit le *rôle*) et à la **RLS Loi 1** (qui dit la *société*).

## Ancrage dans SGI (on bâtit sur l'existant)

- `auth` (JWT + refresh + MFA) → **socle IdP** + step‑up par niveau.
- `iam` (RBAC) → **droits** (inchangé, complémentaire).
- `tenant_kyc` → **fait monter** le niveau (L1 → L2 → L3).
- `document_signature` / `contract_renewal_signature` → signature **gardée derrière `can_sign(level, qualified=…)`**.

## Phasage

- **Brique 1 — Modèle de niveaux d'assurance (LIVRÉE)** : `core/assurance.py`,
  pur, testé (100 %). Aucune migration, aucun câblage encore.
- **Brique 2 — Persistance & calcul du niveau** : stocker l'état de vérification
  par identité (migration), recalcul à chaque preuve (login, KYC), exposer le
  niveau courant dans le JWT/claims.
- **Brique 3 — IdP/SSO interne** : un compte Infinity unique pour web + portails
  + mobile (OIDC issuer interne), step‑up sur action sensible via `can_perform`.
- **Brique 4 — Signature qualifiée maison** : derrière `can_sign`, non‑répudiable
  (hash document + horodatage + identité L2/L3 + journal d'audit).

## Décisions par défaut (à corriger si besoin)

- 4 niveaux **L0–L3** calqués sur SOP1/2/3 (+ un L0 « non prouvé »).
- L2 = Emirates ID vérifié ⇒ signature ; L3 = contrôle renforcé ⇒ qualifiée + ops financières.
- `min_level_for(action)` par défaut **L1** (fail‑safe : jamais en dessous de L1).

## À discuter

1. Confirmer l'échelle (4 niveaux ? quels déblocages exacts par niveau ?).
2. Brique 2 ou Brique 3 ensuite ?
3. Naming public : « Infinity ID » / « UAE Infinity PASS » côté UI ?
