# Sécurité transversale — doctrine `@core/security`

> **Statut : doctrine cible (target architecture).** Ce document définit le service
> transversal `@core/security` que tous les modules SGI devront consommer. Une **partie
> est aspirationnelle** : le SDK `@core/security`, les manifestes, Vault, OPA/Cedar,
> Keycloak n'existent **pas encore** dans le code. Lis d'abord l'encart de
> correspondance ci-dessous pour ne pas confondre la cible avec l'implémenté.
> Origine : `docs/SGI_PROMPT_SECURITY_SECTION.md` (section prompt principal SGI).

---

## 0. Cible vs implémenté aujourd'hui — NE PAS CONFONDRE

Ce que la doctrine décrit n'est pas toujours ce que le code fait *aujourd'hui*. Avant
de t'appuyer sur une primitive citée plus bas, vérifie sa colonne de droite.

| Doctrine (cible) | Réalité SGI aujourd'hui | Où |
|---|---|---|
| `@core/security` SDK (`requireAuth`, `checkPermission`, `encrypt`, `getSecret`…) | ❌ Pas de SDK. Auth + tenant via dépendances FastAPI | `app/core/deps.py`, `app/middleware/tenant.py` |
| `tenant_id` | ✅ même concept, **nommé `company_id`** (Loi 1) | partout |
| Keycloak / OIDC | ❌ JWT interne + **Infinity ID** (IdP maison) | `routers/auth/`, migr. 0059, `core/assurance.py` |
| `@core/secrets` / Vault | ❌ `os.getenv()` via `config.py` | `app/core/config.py` |
| `@core/iam` (OPA/Cedar, ABAC) | ⚠️ router **`iam`** RBAC hiérarchique (pas OPA) | `routers/iam/`, migr. 0036 |
| `@core/audit` signé append-only | ⚠️ `audit_logs` + `AuditMiddleware` (non signé) | `app/middleware/`, table `audit_logs` |
| `@core/crypto` (chiffrement champ par champ, KMS) | ⚠️ partiel — bcrypt mdp, pas de field-level KMS généralisé | `core/config.py` (`BCRYPT_ROUNDS`) |
| `@core/detection` / `@core/response` (SIEM, UEBA, SOAR) | ⚠️ embryon : `admin` console (alerts/audit/infra), Prometheus/Loki/Sentry | `routers/admin/`, `infra/monitoring/` |
| `security/manifest.yaml` par module | ❌ aucun manifeste sur disque | — |
| Step-up adaptatif | ✅ assurance L0–L3 + step-up | `core/assurance.py`, migr. 0059 |
| doc compagnon `module-securite-specification-operationnelle.md` | ❌ référencé mais absent | — |

**Règle pratique :** les **3 invariants verrouillés** (§4) sont *déjà* la réalité du
projet (ce sont les 3 Lois du `CLAUDE.md` racine). Le reste guide la trajectoire — ne
prétends jamais en code/commit qu'une primitive cible existe si elle n'est pas dans le
tableau ci-dessus côté « réalité ».

---

## 1. Position dans l'architecture SGI

`@core/security` est un **service transversal** au même titre que `@core/auth`,
`@core/audit`, `@core/communication`. Il n'est pas autonome : même cycle de vie, même
déploiement, même monorepo. Il regroupe et étend :

```
@core/security
  ├─ @core/auth          (existant — auth, sessions, tokens JWT + Infinity ID)
  ├─ @core/iam           (router iam — RBAC ; cible : ABAC + moteur de policies)
  ├─ @core/secrets       (cible — interface Vault, rotation, TTL)
  ├─ @core/crypto        (cible — chiffrement champ par champ, KMS)
  ├─ @core/audit         (audit_logs — à durcir : append-only signé)
  ├─ @core/detection     (cible — radar : signatures, UEBA, déception, SIEM)
  ├─ @core/policy        (cible — moteur de score de risque, décisions)
  └─ @core/response      (cible — chasseur : playbooks SOAR, kill switches)
```

Tout module métier **consomme** ces services via le SDK + middleware. Aucune logique de
sécurité custom dans un module métier.

---

## 2. Doctrine — principes non négociables

1. **Zero Trust** — aucun canal de confiance, y compris le LAN. Tous les clients passent par la même passerelle, mêmes contrôles.
2. **Defense in depth** — chaque couche suppose que la précédente peut tomber.
3. **Secure-by-default** — contrôles actifs par défaut ; désactivation = exception.
4. **Fail-secure** — en cas de doute/erreur, refuser. Jamais s'ouvrir par défaut.
5. **OODA continue** — observer (radar) → orienter/décider (policies) → agir (chasseur) → recommencer.
6. **Humain dans la boucle** — actions destructrices préparées par la machine, déclenchées par un humain (IA non autonome).
7. **Privacy by design** — conformité PDPL UAE intégrée à l'architecture, pas après coup.

---

## 3. Le contrat de sécurité — manifeste par module (cible)

Chaque module devra fournir `{module}/security/manifest.yaml` :

```yaml
module: realestate
version: 1.0
resources:
  - name: bail
    sensitivity: high
    encrypted_fields: [iban, emirates_id]
    pdpl_classification: personal_data
  - name: cheque_pdc
    sensitivity: critical
    encrypted_fields: [account_number, image]
actions:
  - resource: bail
    verbs: [read, create, update, sign, terminate]
  - resource: cheque_pdc
    verbs: [read, encash, return]
roles:
  - name: agent
    abac_scope: [company_id, branche_id, portefeuille_id]   # company_id = tenant SGI
  - name: manager
    abac_scope: [company_id, branche_id]
audit_events: [bail.created, bail.signed, cheque_pdc.encashed]
secrets: [asterisk/ami/credentials, dewa/api_key]
compliance_tags: [pdpl, kyc, rera]
tunable_controls:
  mfa_strict: enabled
  rate_limiting_strict: enabled
  strict_validation: enabled
  deception: enabled
```

**Handshake à l'amorçage :** le SDK envoie le manifeste à `@core/security` qui le valide.
Manifeste invalide/absent → le module ne démarre pas (fail-secure).

> ⚠️ Note vocabulaire : la doctrine parle de `tenant_id` ; dans SGI le tenant **est
> `company_id`** (Loi 1). Tout `abac_scope`/scoping s'appuie sur `company_id`.

---

## 4. Invariants verrouillés — jamais désactivables

Ce sont les **3 Lois** du `CLAUDE.md` racine, déjà appliquées :

| Invariant | Implémentation SGI réelle |
|---|---|
| **Identité** | auth JWT + Infinity ID requise pour tout endpoint (`deps.py`) |
| **Isolation tenant** | RLS PostgreSQL sur toute table à `company_id` + injection `SET LOCAL` par `TenantMiddleware` (Loi 1) |
| **Audit** | `audit_logs` + `AuditMiddleware` (cible : append-only signé + vérif d'intégrité) |

Désactiver l'un = casser la plateforme. Refusé au niveau code.

---

## 5. Contrôles tunables — désactivables sous gouvernance

| Contrôle | État défaut | Désactivable |
|---|---|---|
| MFA renforcée | activé | oui — par module/rôle |
| Rate limiting strict | activé | oui — par endpoint |
| Validation stricte des entrées | activé | non recommandé |
| Déception (honeytokens) | activé | oui — par tenant |
| Détection UEBA | activé | oui — plateforme |
| Step-up adaptatif | activé | oui — par action |

**Toute désactivation déclenche :** trace `audit_logs` (auteur, raison, n° ticket) ·
TTL d'auto-réactivation (≤ 72h) · approbation à 2 personnes · alerte critique au radar ·
événement réglementaire si le contrôle protégeait des données PDPL.

---

## 6. Le radar — surveillance multi-axes (8 axes)

| Axe | Spécificité SGI |
|---|---|
| Réseau | DDoS, JA3/JA4, voyage impossible, géoloc UAE/offshore |
| Identité | échecs MFA, sessions concurrentes, modif email/téléphone de compte |
| Comportement (UEBA) | exports massifs, accès hors horaire, séquences atypiques |
| Application | **accès inter-tenant = signal critique** (IDOR/BOLA), IDs séquentiels |
| Infrastructure | processus Asterisk anormaux, connexions sortantes imprévues (eBPF/Falco) |
| Téléphonie | toll fraud, INVITE flood, échecs SIP en rafale, durées atypiques |
| Données | accès champs chiffrés (Emirates ID, IBAN, PDC), accès honeytokens |
| Supply chain | nouvelles dépendances, vulnérabilités SBOM |

---

## 7. Le chasseur — réponses graduées par score (0–100)

| Score | Réponse | Acteur |
|---|---|---|
| 0–30 | passive (log) | auto |
| 30–60 | légère (rate limit, friction, alerte) | auto |
| 60–80 | forte (révocation, blocage IP) | auto + alerte admin |
| 80–95 | destructive proposée en console | humain en 1 clic |
| 95–100 | break-glass | humain + approbation à 2 |

**Ciblage SGI :** IP, ASN, pays, protocole, OS, login, rôle, **société (`company_id`)**,
branche, module, session, score, pattern, heure.

**Actions spécifiques SGI :** *kill switch tenant* (isoler une société compromise) ·
*coupure SIP trunk* (toll fraud, approbation humaine) · *quarantaine module* (désactiver
Call Center en gardant RealEstate vivant).

---

## 8. Le repli — playbooks pré-définis (P-01 → P-10)

Trois sont stratégiques pour SGI :

- **P-05 — Toll fraud Asterisk** : pic d'appels internationaux → plafonnement auto + proposition humaine de couper le trunk.
- **P-06 — Rupture d'isolation multi-tenant** : tentative cross-tenant détectée → capture forensique + isolation tenant + déclenchement P-08.
- **P-08 — Violation PDPL** : fuite de PII confirmée → qualification + **notification UAE Data Office sans délai** + notification des personnes si risque élevé + dossier réglementaire.

---

## 9. Conformité UAE — intégrée par design

| Réglementation | Intégration SGI |
|---|---|
| **PDPL** (Federal Decree-Law 45/2021) | classification PDPL des champs au manifeste · notification sans délai (P-08) · registre des traitements généré depuis les manifestes |
| **KYC / AML / goAML** | audit traçant les vérifs KYC · signalement goAML · zones franches (DIFC/ADGM) = régime distinct |
| **TDRA** | trunk SIP via opérateur licencié uniquement · chiffrement SRTP, AMI cloisonné |
| **RERA / Ejari / DLD / DEWA / ADDC** | accès aux API régulateurs via `@core/secrets` · audit complet de chaque appel |

---

## 10. Trajectoire — alignée sur les phases SGI

| Phase | Livrables sécurité |
|---|---|
| **Socle** | SDK + middleware · Keycloak · Vault · audit immuable · RLS multi-tenant · WAF + rate limiting · chiffrement at-rest + champ par champ · sauvegardes testées |
| **Opérations** | OPA/Cedar (ABAC) · MFA généralisée · honeytokens · playbooks P-01→P-05 · pen test externe |
| **Intelligence** | SIEM corrélé · UEBA · SOAR · console admin triage IA · eBPF (Falco) · playbooks P-06→P-10 |
| **Différenciation** | onboarding industrialisé d'apps externes · agentic AI SOC · post-quantum planifié |

---

## 11. Directives opérationnelles pour Claude Code

> Sur **n'importe quel module SGI**, respecter ces règles sans exception.

### Règles d'or

1. **Vérifier le manifeste avant tout** *(cible)* : pas de `security/manifest.yaml` valide → le créer/compléter avant toute ligne de code applicative.
2. **Utiliser exclusivement le SDK `@core/security`** *(cible — aujourd'hui : `deps.py` + middleware)* : pas d'auth/authz/chiffrement/secrets custom. Primitives : `requireAuth()`, `checkPermission(actor, action, resource)`, `auditEvent(name, payload)`, `encrypt/decrypt(field)`, `getSecret(name)`, `emitSecurityEvent(type, payload)`.
3. **Scoping tenant obligatoire** *(réel)* : toute requête multi-tenant s'appuie sur le **`company_id` du contexte**, jamais une valeur client. Le middleware injecte ; l'ORM honore la RLS ; ne jamais contourner.
4. **Aucun secret en dur** : ni code, ni `.env` versionné, ni config statique. Via `@core/secrets`/`os.getenv()`.
5. **Émettre les événements d'audit déclarés** : tout `audit_events` du manifeste doit être réellement émis (test de contrat en CI — cible).
6. **Chiffrer les champs déclarés** : tout `encrypted_fields` transite par `@core/crypto`, jamais en clair.
7. **Fail-secure** : erreur, policy absente, doute → refuser.
8. **Ne jamais désactiver un invariant** : identité, isolation tenant, audit. Refuser toute proposition qui les contourne, même temporaire.
9. **Désactivation d'un tunable** : workflow d'approbation + audit + TTL + événement critique.
10. **Dans le doute, demander** : décision ambiguë touchant ces points → arrêter et demander clarification.

### Checklist à chaque nouvelle fonctionnalité

- [ ] Déclarée au manifeste (resources, actions, audit events) *(cible)*
- [ ] Autorisation posée explicitement (`checkPermission` / dépendance authz)
- [ ] Champs sensibles déclarés `encrypted_fields` et chiffrés
- [ ] Secrets déclarés et récupérés via `getSecret`/`os.getenv()`
- [ ] Événements d'audit émis aux points sensibles
- [ ] **Scoping `company_id` respecté + test cross-tenant** (Red-Team Loi 1 : réponse ≠ 404 = no-go)
- [ ] Entrées validées (types par middleware/Pydantic, logique métier par le code)
- [ ] Si PII : étiquette PDPL ajoutée au manifeste

### Refus systématique

Refuser le code qui : court-circuite auth / isolation tenant / audit · introduit des
secrets en dur · expose un port sensible (5038 AMI, 5432 PG, 6379 Valkey) publiquement ·
désactive un contrôle hors workflow gouvernance · contourne la RLS PostgreSQL ou la
validation des manifestes · ajoute une dépendance avec CVE critique non patchée.

---

## 12. Référence détaillée

Détails opérationnels (catalogue des paramètres surveillés, 14 actions de réponse, 10
playbooks pas à pas, calendrier d'audit, KPI) → doc compagnon **à créer** :
`docs/security/module-securite-specification-operationnelle.md` *(absent aujourd'hui)*.

Cette doctrine et ce document détaillé sont **les deux faces d'une même politique** :
la doctrine fixe les règles que Claude Code applique, le document détaille l'opération du
système une fois en place.
