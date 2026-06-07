# `@core/security` — spécification opérationnelle

> **Statut : doctrine cible (target).** Ce document est le **pendant opérationnel** de la
> doctrine [docs/architecture/security-core.md](../architecture/security-core.md) : la doctrine
> fixe les *règles* que Claude Code applique en codant ; ce document détaille *comment opérer*
> le système une fois en place. La majorité des briques décrites (`@core/detection`,
> `@core/response`, SIEM, UEBA, SOAR, Vault, OPA/Cedar) **n'existent pas encore** dans le code —
> voir l'encart « Cible vs implémenté » de la doctrine §0. Ce qui est *déjà réel* est annoté
> *(réel)* ; le reste est la trajectoire.
>
> Vocabulaire SGI : le tenant **est `company_id`** (Loi 1) ; l'identité = JWT + Infinity ID
> (`core/assurance.py`) ; l'audit = `audit_logs` + `AuditMiddleware` ; le téléphone = Asterisk
> (`routers/telephony/`) ; le monitoring réel = Prometheus / Grafana / Loki / Sentry
> (`infra/monitoring/`).

---

## Sommaire

1. [Paramètres surveillés — les 8 axes du radar (exhaustif)](#1-paramètres-surveillés--les-8-axes-du-radar)
2. [Score de risque — comment il est calculé](#2-score-de-risque--composition-et-décroissance)
3. [Catalogue des 14 actions de réponse](#3-catalogue-des-14-actions-de-réponse)
4. [Les 10 playbooks (P-01 → P-10) pas à pas](#4-les-10-playbooks-p-01--p-10)
5. [Calendrier d'audit périodique](#5-calendrier-daudit-périodique)
6. [KPI sécurité](#6-kpi-sécurité)
7. [Gouvernance des désactivations de contrôles tunables](#7-gouvernance-des-désactivations)
8. [Break-glass — procédure d'urgence](#8-break-glass--procédure-durgence)

---

## 1. Paramètres surveillés — les 8 axes du radar

`@core/detection` observe en continu. Pour chaque paramètre : la **source** du signal, le
**seuil/déclencheur** indicatif, et la **contribution au score** (Δ). Les seuils par défaut sont
*tunables* (§7) ; ils sont indicatifs, pas contractuels.

### Axe 1 — Réseau

| Paramètre | Source | Déclencheur indicatif | Δ score |
|---|---|---|---|
| DDoS volumétrique | WAF / Nginx / reverse-proxy | RPS > 10× baseline sur une IP/ASN | +20 |
| Empreinte TLS (JA3/JA4) anormale | proxy TLS | JA3 inconnu + pattern bot | +15 |
| Voyage impossible | géoloc IP + session | 2 logins distants > vitesse vol | +30 |
| Géoloc UAE vs offshore | géoloc IP | accès sensible depuis hors GCC non whitelisté | +15 |
| Scan de ports / fuzzing | firewall / IDS | balayage séquentiel d'endpoints | +10 |
| Tor / VPN / proxy connu | listes de réputation | accès admin via exit-node Tor | +15 |

### Axe 2 — Identité

| Paramètre | Source | Déclencheur indicatif | Δ score |
|---|---|---|---|
| Échecs d'authentification | `routers/auth` | > 5 échecs / 5 min / compte | +15 |
| Échecs MFA / step-up | `core/assurance.py` *(réel)* | > 3 échecs step-up consécutifs | +20 |
| Sessions concurrentes | store de sessions (Valkey) | > N sessions actives / compte depuis géos distinctes | +15 |
| Modification email / téléphone de compte | `routers/auth` / `iam` | changement de canal de récupération | +25 |
| Élévation de privilège | `routers/iam` | attribution de rôle admin hors workflow | +30 |
| Login hors plage horaire habituelle | UEBA | accès à 03:00 pour un profil 09–18 | +10 |

### Axe 3 — Comportement (UEBA)

| Paramètre | Source | Déclencheur indicatif | Δ score |
|---|---|---|---|
| Export massif de données | endpoints d'export / Celery `exports` | volume > 5× moyenne du rôle | +25 |
| Accès hors horaire | profil temporel par utilisateur | écart > 3σ du profil | +10 |
| Séquence d'actions atypique | modèle de parcours | enchaînement jamais observé pour le rôle | +15 |
| Balayage d'IDs | logs applicatifs | accès à N ressources d'IDs croissants | +20 |
| Volume de lectures de PII | hook `@core/crypto` | déchiffrements Emirates ID/IBAN > seuil | +20 |

### Axe 4 — Application

| Paramètre | Source | Déclencheur indicatif | Δ score |
|---|---|---|---|
| **Accès inter-tenant (IDOR/BOLA)** | RLS + middleware | réponse à une ressource d'un autre `company_id` | **+50 (critique)** |
| IDs séquentiels / énumération | logs applicatifs | requêtes sur IDs voisins en rafale | +20 |
| Erreurs 4xx en rafale | logs applicatifs | > 50 × 401/403 / min / session | +15 |
| Injection (SQL/NoSQL/cmd) tentée | validation Pydantic / WAF | payload matché par règle WAF | +25 |
| Manipulation de paramètres sensibles | validation | `company_id`/`role` fourni côté client | +30 |
| Accès à un endpoint déprécié/caché | routing | hit sur route non publiée | +10 |

### Axe 5 — Infrastructure

| Paramètre | Source | Déclencheur indicatif | Δ score |
|---|---|---|---|
| Processus anormal (Asterisk, etc.) | eBPF / Falco | exec inattendu dans un conteneur | +25 |
| Connexion sortante imprévue | eBPF / Falco | egress vers IP non whitelistée | +25 |
| Modification de fichier sensible | FIM (file integrity) | écriture sur config/binaire en runtime | +20 |
| Conteneur en dérive (drift) | scanner d'image | image ≠ digest attendu | +15 |
| Épuisement de ressources | Prometheus *(réel)* | CPU/mém > seuil prolongé | +10 |

### Axe 6 — Téléphonie (spécifique SGI)

| Paramètre | Source | Déclencheur indicatif | Δ score |
|---|---|---|---|
| Toll fraud (appels internationaux) | CDR Asterisk *(réel)* | pic d'appels premium/intl hors profil | **+40** |
| INVITE flood | AMI / SIP | rafale d'INVITE depuis une IP | +25 |
| Échecs SIP en rafale | logs SIP | 401/403 SIP répétés (brute-force trunk) | +20 |
| Durées d'appel atypiques | CDR | appels > N heures ou micro-appels en masse | +15 |
| Enregistrement SIP depuis IP inconnue | AMI | REGISTER hors plage opérateur licencié | +20 |

### Axe 7 — Données

| Paramètre | Source | Déclencheur indicatif | Δ score |
|---|---|---|---|
| Accès aux champs chiffrés | hook `@core/crypto` | déchiffrement Emirates ID / IBAN / PDC | +15 |
| Accès aux **honeytokens** | déception | toute lecture d'un leurre = signal pur | **+60 (quasi-certain)** |
| Volume de déchiffrement anormal | `@core/crypto` | > seuil / session | +25 |
| Export de table sensible | Celery `exports` | dump `bail`/`pdc`/`clients` complet | +30 |
| Accès à des données soft-deleted | ORM | lecture de `deleted_at IS NOT NULL` | +15 |

### Axe 8 — Supply chain

| Paramètre | Source | Déclencheur indicatif | Δ score |
|---|---|---|---|
| Nouvelle dépendance | CI / SBOM | ajout à `pyproject`/`package.json` | +10 |
| CVE critique dans le SBOM | scanner (Trivy/Grype) | CVSS ≥ 9.0 non patchée | +30 |
| Image de base obsolète | scanner | base EOL / sans patch | +15 |
| Artefact non signé | pipeline | build sans signature/attestation | +20 |
| Typosquatting de paquet | analyse de dépendances | nom proche d'un paquet connu | +25 |

---

## 2. Score de risque — composition et décroissance

- **Échelle 0–100**, agrégée par **entité ciblée** : IP, ASN, pays, login, rôle, **société
  (`company_id`)**, branche, module, session.
- **Composition** : score = somme pondérée des Δ actifs sur une fenêtre glissante, plafonnée à 100.
  Certains signaux sont *plafonnants* — un accès inter-tenant confirmé (Axe 4) ou un honeytoken
  (Axe 7) propulse seul au-delà des seuils destructeurs.
- **Décroissance** : Δ contribué par un signal décroît linéairement sur sa fenêtre (réseau 15 min,
  comportement 24 h, identité 1 h) sauf signaux *latching* (honeytoken, inter-tenant) qui restent
  jusqu'à acquittement humain.
- **Multiplicateurs de contexte** : ×1.5 si la cible manipule des PII PDPL, ×2 si l'action vise un
  invariant verrouillé (§4 doctrine).

| Score | Bande | Réponse (cf. §3) | Acteur |
|---|---|---|---|
| 0–30 | passive | log/observe | auto |
| 30–60 | légère | rate-limit, friction, alerte | auto |
| 60–80 | forte | révocation session, blocage IP | auto + alerte admin |
| 80–95 | destructive proposée | en console, 1 clic | humain |
| 95–100 | break-glass | isolation/coupure | humain + approbation à 2 |

---

## 3. Catalogue des 14 actions de réponse

`@core/response` exécute des actions **graduées** et **réversibles** par défaut. Chaque action
émet un événement d'audit et, si destructive, exige un déclencheur humain (doctrine : humain dans
la boucle).

| # | Action | Bande | Réversible | Acteur | Effet |
|---|---|---|---|---|---|
| A-01 | **Log enrichi** | passive | n/a | auto | trace structurée + corrélation, aucun impact |
| A-02 | **Friction adaptative** | légère | oui | auto | re-CAPTCHA / délai progressif sur la session |
| A-03 | **Rate-limit dynamique** | légère | oui (TTL) | auto | abaisse le quota IP/endpoint/session |
| A-04 | **Step-up forcé** | légère | oui | auto | exige une ré-authentification L2/L3 (`core/assurance.py`) |
| A-05 | **Alerte SOC/admin** | légère→forte | n/a | auto | notification console + canal d'astreinte |
| A-06 | **Révocation de session** | forte | oui | auto | invalide les tokens de la session suspecte |
| A-07 | **Blocage IP / ASN** | forte | oui (TTL) | auto | drop au WAF, TTL d'auto-levée |
| A-08 | **Verrou de compte** | forte | oui | auto+admin | gèle un compte, exige réinitialisation pilotée |
| A-09 | **Quarantaine de session forensique** | forte | oui | auto | fige la session + capture le contexte (pas de purge) |
| A-10 | **Capture forensique** | forte | n/a | auto | snapshot logs/CDR/contexte pour enquête (immuable) |
| A-11 | **Plafonnement téléphonie** | forte | oui | auto | borne les appels intl/premium (anti toll-fraud) |
| A-12 | **Coupure SIP trunk** | destructive | oui | **humain** | ferme le trunk (toll-fraud avéré) — approbation requise |
| A-13 | **Quarantaine module** | destructive | oui | **humain** | désactive un module (ex. Call Center) en gardant le reste |
| A-14 | **Kill switch tenant** | break-glass | oui | **humain + 2 pers.** | isole une `company_id` compromise sans toucher les autres |

> Toute action A-12 → A-14 est **préparée par la machine, déclenchée par un humain** depuis la
> console (un clic pour A-12/A-13 ; double approbation pour A-14). Aucune action destructive n'est
> jamais automatique.

---

## 4. Les 10 playbooks (P-01 → P-10)

Écrits à froid, versionnés, rejoués à l'identique. Format : **Déclencheur → Détection → Réponse
auto → Décision humaine → Clôture**. Les trois playbooks stratégiques SGI (P-05, P-06, P-08) sont
détaillés ; les autres sont cadrés.

### P-01 — Brute-force / credential stuffing
- **Déclencheur** : Axe 2, échecs d'auth/MFA en rafale.
- **Réponse auto** : A-03 (rate-limit) → A-02 (friction) → A-08 (verrou compte) au seuil.
- **Humain** : confirmer compromission → reset piloté + notification utilisateur.
- **Clôture** : levée des verrous, post-mortem si compte privilégié touché.

### P-02 — Détournement de session / vol de token
- **Déclencheur** : Axe 1 (voyage impossible) + Axe 2 (session concurrente).
- **Réponse auto** : A-06 (révocation session) + A-04 (step-up) + A-10 (capture).
- **Humain** : valider la légitimité, rotation des secrets de session si confirmé.

### P-03 — Énumération / IDOR (sans fuite cross-tenant)
- **Déclencheur** : Axe 4, IDs séquentiels / 403 en rafale.
- **Réponse auto** : A-03 + A-07 (blocage IP) + A-05 (alerte).
- **Humain** : revue de l'endpoint, vérifier l'authz BOLA.
- **Escalade** : si une réponse révèle un autre `company_id` → bascule **P-06**.

### P-04 — Exfiltration de données (export massif)
- **Déclencheur** : Axe 3 (export massif) ou Axe 7 (déchiffrement anormal).
- **Réponse auto** : A-09 (quarantaine session) + A-10 (forensique) + A-05.
- **Humain** : qualifier (légitime vs malveillant) ; si PII → bascule **P-08**.

### P-05 — Toll fraud Asterisk ★
- **Déclencheur** : Axe 6 — pic d'appels internationaux/premium hors profil, ou INVITE flood.
- **Détection** : corrélation CDR + AMI ; comparaison au profil d'appel de la `company_id`.
- **Réponse auto** : **A-11 (plafonnement)** immédiat des destinations premium/intl + A-05 (alerte
  astreinte) + A-10 (capture CDR).
- **Décision humaine** : si fraude confirmée → **A-12 (coupure SIP trunk)** en un clic, après
  vérification que l'opérateur est bien le trunk licencié (TDRA).
- **Clôture** : plafond conservé jusqu'à analyse ; rapport coût estimé ; révision des plafonds par
  défaut de la société.

### P-06 — Rupture d'isolation multi-tenant ★
- **Déclencheur** : Axe 4 — **accès inter-tenant détecté** (réponse non vide à une ressource d'un
  autre `company_id`). Signal *latching*, score plafonnant.
- **Détection** : middleware/RLS + corrélation ; **toute réponse ≠ 404/vide en cross-tenant est un
  incident** (gate Red-Team Loi 1).
- **Réponse auto** : **A-10 (capture forensique)** complète + **A-09 (quarantaine de la session
  fautive)** + A-06 (révocation) + A-05 (alerte critique).
- **Décision humaine** : confirmer la portée (lecture seule ? écriture ?) ; si données réellement
  exposées → **déclencher P-08** (violation PDPL).
- **Conteneur** : si la cause est systémique (RLS contournée) → **A-13/A-14** pour isoler le tenant
  victime/attaquant le temps du correctif. Correctif RLS = priorité absolue, PR-blocker.
- **Clôture** : post-mortem obligatoire, test de non-régression cross-tenant ajouté à la CI.

### P-07 — Compromission d'infrastructure / conteneur
- **Déclencheur** : Axe 5 — processus/egress anormal (eBPF/Falco) ou drift d'image.
- **Réponse auto** : A-09 (isolation réseau du pod) + A-10 + A-05.
- **Humain** : décider rebuild from clean image ; rotation des secrets exposés (`@core/secrets`).

### P-08 — Violation PDPL (fuite de PII) ★
- **Déclencheur** : confirmation d'exposition de données personnelles (souvent via P-04 ou P-06).
- **Qualification** : nature des données (Emirates ID, IBAN, PDC, contacts), volume, nombre de
  personnes, niveau de risque.
- **Réponse auto** : A-10 (préservation des preuves, journal immuable) + gel des accès concernés.
- **Obligations réglementaires** (PDPL — Federal Decree-Law 45/2021) :
  - **notification au UAE Data Office sans délai** ;
  - **notification des personnes affectées** si risque élevé pour leurs droits ;
  - constitution du **dossier réglementaire** (chronologie, périmètre, mesures).
- **Humain** : DPO + direction ; coordination juridique ; communication.
- **Clôture** : registre des traitements mis à jour, mesures correctives, leçons.

### P-09 — Insider / abus de privilège
- **Déclencheur** : Axe 2 (élévation) + Axe 3 (séquence atypique) sur compte interne légitime.
- **Réponse auto** : A-04 (step-up) + A-09 + A-05 (alerte discrète, pas d'alerte à l'intéressé).
- **Humain** : RH + sécurité ; revue d'accès ; principe du moindre privilège ré-appliqué.

### P-10 — Supply chain (dépendance/CVE)
- **Déclencheur** : Axe 8 — CVE critique, typosquatting, artefact non signé.
- **Réponse auto** : blocage du déploiement (CI) + A-05 + ouverture ticket.
- **Humain** : décider patch/rollback/pinning ; vérifier exploitation in-the-wild.

---

## 5. Calendrier d'audit périodique

| Fréquence | Contrôle |
|---|---|
| **Continu** | radar 8 axes ; vérification d'intégrité du journal d'audit ; alerting Prometheus *(réel)* |
| **Quotidien** | revue des alertes 60–95 non clôturées ; échecs MFA agrégés ; nouveaux honeytokens touchés |
| **Hebdomadaire** | revue des désactivations de contrôles tunables (§7) et de leurs TTL ; diff SBOM/CVE ; sessions privilégiées |
| **Mensuel** | revue des accès & rôles (`iam`) — moindre privilège ; rotation des secrets non automatisés ; test de restauration d'une sauvegarde |
| **Trimestriel** | rejeu des 10 playbooks en table-top ; **gate Red-Team Loi 1** sur tous les endpoints du trimestre ; revue des plafonds téléphonie |
| **Semestriel** | **pen test externe** ; revue de la matrice de conformité (PDPL/KYC/TDRA/RERA) ; exercice break-glass |
| **Annuel** | revue complète de la doctrine + manifestes ; audit PDPL formel ; plan post-quantum |

---

## 6. KPI sécurité

| KPI | Définition | Cible |
|---|---|---|
| **MTTD** | délai détection moyen d'un incident | < 5 min (signaux latching : temps réel) |
| **MTTR** | délai endiguement moyen (jusqu'à action forte/destructive) | < 30 min |
| **Taux de faux positifs** | alertes ≥ 60 invalidées / total | < 10 % |
| **Couverture manifestes** | modules avec `manifest.yaml` valide / total *(cible)* | 100 % |
| **Couverture audit** | `audit_events` déclarés réellement émis (test de contrat) | 100 % |
| **Cross-tenant** | incidents P-06 confirmés | **0** (tout > 0 = critique) |
| **Toll fraud** | coût téléphonie frauduleux évité / détecté | tendance ↓ |
| **TTL respectés** | désactivations tunables ré-activées avant expiration | 100 % |
| **CVE critiques** | CVE ≥ 9.0 ouvertes en prod | 0 |
| **Délai notification PDPL** | de la confirmation à la notification UAE Data Office | sans délai (P-08) |
| **Couverture pen test** | findings critiques/élevés clôturés sous SLA | 100 % |

---

## 7. Gouvernance des désactivations

Rappel doctrine §5 — un contrôle *tunable* (MFA renforcée, rate-limit strict, validation,
honeytokens, UEBA, step-up adaptatif) ne peut être désactivé que via le workflow suivant, jamais
ad hoc :

1. **Demande** liée à un ticket (auteur, raison, périmètre, durée souhaitée).
2. **Approbation à deux personnes** (séparation des rôles).
3. **Trace immuable** dans `audit_logs` (qui, quoi, pourquoi, ticket).
4. **TTL d'auto-réactivation** — défaut **72 h max** ; au-delà, réactivation forcée.
5. **Alerte critique au radar** — la désactivation est elle-même un événement à observer.
6. **Événement réglementaire** si le contrôle protégeait des données PDPL.

Les **invariants verrouillés** (identité, isolation tenant, audit — = les 3 Lois) **ne sont jamais
désactivables**, par aucun de ces chemins.

---

## 8. Break-glass — procédure d'urgence

Réservé aux scores 95–100 et aux actions A-14 (kill switch tenant) :

- **Double approbation humaine** obligatoire (deux opérateurs distincts).
- **Fenêtre limitée** + journalisation renforcée de chaque geste effectué sous break-glass.
- **Réversibilité** : l'isolation tenant/coupure est conçue pour être levée une fois la menace
  écartée (pas de destruction de données — soft-delete et snapshots préservés).
- **Post-mortem obligatoire** sous 48 h : chronologie, décisions, impact, correctifs, mise à jour
  du playbook concerné.

---

*Document compagnon de [docs/architecture/security-core.md](../architecture/security-core.md).
Les deux faces d'une même politique : la doctrine fixe les règles, ce document décrit l'opération.*
