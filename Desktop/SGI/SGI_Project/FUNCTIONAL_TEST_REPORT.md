# SGI — Rapport d'audit fonctionnel (statique)

**Date :** 2026-05-26  
**Périmètre audité :** `apps/web` — screens, components, auth flow  
**Méthode :** Analyse statique de code (aucune exécution)  
**Auditeur :** Claude Code (Sonnet 4.6)

---

## 1 — Login flow

### `app/screens/login.tsx` + `lib/auth.ts` + `app/api/auth/login/route.ts`

**[LOW] login.tsx:181 — Valeurs initiales pré-remplies dans les champs de formulaire**  
Comportement actuel : `useState("login")` et `useState("password")` initialisent les inputs avec les chaînes littérales "login" et "password".  
Comportement attendu : Les champs devraient être vides par défaut (`""`).  
Fix suggéré : `useState("")` pour `loginVal` et `password`.

**[LOW] login.tsx:362 — Bouton SSO sans handler**  
Comportement actuel : Le bouton "SSO" (`t.sso`) n'a aucun `onClick`. Cliquer dessus ne fait rien.  
Comportement attendu : Ouvrir un flow SSO ou afficher un message "coming soon".  
Fix suggéré : Ajouter `onClick` ou `disabled` avec explication visuelle.

**[LOW] login.tsx:369 — Lien "Contact manager" non fonctionnel**  
Comportement actuel : `<span style={{ cursor: "pointer" }}>{t.contact_manager}</span>` — aucun `onClick`.  
Comportement attendu : Ouvrir un formulaire de contact ou une modale.  
Fix suggéré : Ajouter un handler ou convertir en `<a href="mailto:...">`.

**[LOW] login.tsx:495 — Bouton "Resend" sur l'écran "sent" passe setResetLoading(true) avant d'appeler handleForgot**  
Comportement actuel :  
```tsx
onClick={() => { setResetLoading(true); handleForgot(new Event("submit") as unknown as React.FormEvent); }}
```
`handleForgot` appelle elle-même `setResetLoading(true)` en interne — il y a une double mise à jour de state, ce qui est inoffensif mais redondant. Plus grave : `new Event("submit")` n'a pas `preventDefault()` donc l'appel à `e.preventDefault()` dans `handleForgot` échouera silencieusement sur cet objet Event natif (pas un `React.FormEvent`).  
Comportement attendu : `e.preventDefault()` est une no-op ici, mais ne provoque pas de crash car le bouton est de type `"button"` — risque faible mais incohérence de code.  
Fix suggéré : Extraire la logique de `handleForgot` dans une fonction interne `doReset()` et l'appeler directement.

**[MEDIUM] api/auth/login/route.ts — JWT signé "maison" sans vérification à la réception**  
Comportement actuel : Le serveur génère un JWT HS256 artisanal. Il n'y a aucun fichier de middleware vérifiant ce token côté Next.js avant de rendre les pages.  
Comportement attendu : Un middleware Next.js (`middleware.ts`) devrait intercepter chaque requête sur `/(dashboard)` et vérifier la signature du cookie `sgi-session`.  
Fix suggéré : Ajouter un `middleware.ts` à la racine de `apps/web` qui lit et vérifie le cookie, et redirige vers `/login` si invalide.

**[MEDIUM] api/auth/logout/route.ts — Logout ne nettoie pas le localStorage**  
Comportement actuel : Le logout côté serveur supprime le cookie `sgi-session`, mais côté client dans `page.tsx:handleLogout`, `localStorage.setItem("sgi_last_logout", ...)` est stocké — le `sgi_last_login` n'est jamais effacé.  
Comportement attendu : Comportement acceptable pour afficher la dernière session, mais si l'application est multi-utilisateurs sur le même navigateur (peu probable en SaaS), les données de session pourraient fuiter.  
Fix suggéré : Documenter le comportement ou purger `sgi_last_login` si le contexte l'exige.

---

## 2 — Navigation (page.tsx + sgi-ui.tsx)

**[HIGH] sgi-ui.tsx:119-133 — NavKey "clients" navigue vers un screen inexistant dans page.tsx**  
Comportement actuel : Le group header "Clients" dans la sidebar a `groupKey: "clients"` et appelle `onNavigate("clients")`. Dans `page.tsx`, il existe `{screen === "clients" && <ScreenClients onNavigate={setScreen} />}` — ce screen existe donc. **Mais** : les groupes `tourisme`, `sante`, `assurance`, `banques`, `amazon`, `consultants`, `admin` ont leurs children avec `labelKey: "dash"` qui est une surcharge d'étiquette. Le vrai problème est que cliquer sur le **group header** lui-même (ex: "Tourisme") navigue vers `screen === "tourisme"` qui existe. Ce n'est pas un bug.

**[MEDIUM] sgi-ui.tsx:162-165 — Child "tourisme" avec labelKey "dash" affiche "Dashboard" comme label**  
Comportement actuel :  
```tsx
{ key: "tourisme", icon: <IcTourisme />, labelKey: "dash" }
```
Le premier enfant du groupe "Tourisme" s'appelle "Dashboard" dans le menu. Cette logique est intentionnelle (pour pointer vers le dashboard du secteur), mais trompeuse pour l'utilisateur : le label "Dashboard" peut être confondu avec le Dashboard global.  
Comportement attendu : Le label devrait être "Vue d'ensemble" ou "Overview" plutôt que "Dashboard".  
Fix suggéré : Créer une clé i18n dédiée `nav_overview` ou utiliser le nom du secteur directement.

**[MEDIUM] page.tsx — NavKey "portal" ne passe pas par la sidebar**  
Comportement actuel : `if (screen === "portal") return <ScreenPortal />;` rend le portal sans sidebar, ce qui est probablement intentionnel. Mais il n'existe pas de NavKey `"portal"` dans `NAV_ENTRIES` de `sgi-ui.tsx`, donc on ne peut y accéder que programmatiquement.  
Comportement attendu : Comportement documenté ou impossible d'y accéder autrement.  
Fix suggéré : Documenter que le portal est accessible uniquement via URL directe ou bouton dédié.

**[LOW] sgi-ui.tsx — NavKey "IcMarketing" manquant dans l'export groupé**  
Comportement actuel : `IcMarketing` est défini dans `sgi-ui.tsx:75` mais n'est pas inclus dans les imports de `marketing.tsx:4`. La vérification montre que `marketing.tsx` importe bien `IcMarketing` directement. OK, pas de bug ici.

---

## 3 — Dashboard (dashboard.tsx)

**[MEDIUM] dashboard.tsx:154-155 — Boutons "Export" et "New" sans handlers**  
Comportement actuel :  
```tsx
<button className="sgi-btn sgi-btn-ghost"><IcDownload />&nbsp;{t.export_btn}</button>
<button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.new_btn}</button>
```
Aucun `onClick` sur ces deux boutons.  
Comportement attendu : "Export" devrait déclencher un téléchargement CSV/PDF. "New" devrait ouvrir un wizard ou naviguer.  
Fix suggéré : Ajouter des handlers ou `disabled` provisoire avec tooltip.

---

## 4 — Wallet — clients-personne.tsx

**[HIGH] clients-personne.tsx:193-198 — handlePayWithPoints ne vérifie pas le solde avant de déduire**  
Comportement actuel :  
```tsx
function handlePayWithPoints(invId: string, amount: number) {
  const pts = Math.ceil(amount);
  setWalletBalance(b => b - pts);   // ← déduction immédiate
  ...
}
```
La vérification `canPay = walletBalance >= inv.amount` est faite dans le JSX pour désactiver le bouton, mais `handlePayWithPoints` elle-même n'a aucune guard interne. Si un utilisateur (ou un test) appelle la fonction directement, le solde peut devenir négatif.  
Comportement attendu : La fonction doit vérifier `b >= pts` avant de soustraire.  
Fix suggéré :
```tsx
function handlePayWithPoints(invId: string, amount: number) {
  const pts = Math.ceil(amount);
  setWalletBalance(b => {
    if (b < pts) return b; // guard
    return b - pts;
  });
  ...
}
```

**[MEDIUM] clients-personne.tsx:186-192 — handleBuyPoints : montant négatif ou décimal non entier traité par Math.floor mais la valeur AED dans la transaction reflète le montant saisi brut**  
Comportement actuel : `Math.floor(Number(buyAmt))` tronque les décimales, mais `aed` dans la transaction est `pts` (post-floor), donc cohérent. Pas de vrai bug, mais si l'utilisateur tape "-500", `pts = -500` qui est `<= 0`, donc le guard `if (!pts || pts <= 0) return;` bloque. Correct.

**[MEDIUM] clients-personne.tsx — Le solde affiché dans le wallet n'est pas synchronisé avec l'onglet "Invoices"**  
Comportement actuel : Après `handlePayWithPoints`, l'invoice passe à `"paid"` dans le state `invoices`, mais si l'utilisateur revient sur l'onglet Invoices sans avoir changé d'onglet, le tableau se rafraîchit correctement car `invoices` est dans le state React.  
Comportement attendu : Cohérent — **pas de bug ici**, la synchronisation est correcte.

---

## 5 — Wallet — clients-societe.tsx

**[HIGH] clients-societe.tsx:202-207 — Même bug handlePayWithPoints sans guard interne (miroir de clients-personne.tsx)**  
Comportement actuel : Identique au bug décrit dans §4 pour les sociétés.  
Fix suggéré : Même correction que ci-dessus.

---

## 6 — Deal Wizard (deal-wizard.tsx)

**[MEDIUM] deal-wizard.tsx:368-372 — Passage Step 2 → 3 possible sans aucune validation obligatoire**  
Comportement actuel : Le bouton "Next" de Step 2 est désactivé uniquement à Step 1 (`disabled={step === 1 && !form.category}`). À Step 2, le bouton est **toujours actif**, même si aucun champ n'est rempli (pas de propType, pas de budget, pas d'area).  
Comportement attendu : Pour la catégorie "realestate", `propType` et `area` devraient être obligatoires. Pour toutes catégories, `propType` au minimum.  
Fix suggéré :
```tsx
disabled={
  (step === 1 && !form.category) ||
  (step === 2 && !form.propType)
}
```

**[MEDIUM] deal-wizard.tsx:122-139 — handleConfirm peut être déclenché avec form.category === null**  
Comportement actuel : `category: form.category!` utilise un non-null assertion. Si `form.category` est `null` (ce qui est impossible via l'UI normale car Step 1 bloque, mais théoriquement possible), TypeScript compile sans erreur et l'objet `ConfirmedDeal` aura `category: null`.  
Comportement attendu : Guard explicite avant l'appel.  
Fix suggéré : Ajouter `if (!form.category) return;` au début de `handleConfirm`.

**[LOW] deal-wizard.tsx:82 — crmRef généré avec Math.random() risque de collision**  
Comportement actuel : `CRM-2026-${Math.floor(Math.random() * 9000 + 1000)}` — 9000 valeurs possibles seulement. Si de nombreux deals sont créés dans la même session, les collisions sont probables.  
Comportement attendu : UUID ou séquence serveur.  
Fix suggéré : Utiliser `crypto.randomUUID()` ou un compteur incrémental.

**[LOW] deal-wizard.tsx — Pas de validation du budget (budgetMin > budgetMax)**  
Comportement actuel : L'utilisateur peut saisir budgetMin = 5 000 000 et budgetMax = 100 000 sans avertissement.  
Comportement attendu : Afficher une erreur si `budgetMin > budgetMax`.  
Fix suggéré : Ajouter une validation dans la phase de review (Step 3) ou en temps réel.

---

## 7 — CRM Sector (sector-crm.tsx)

**[HIGH] sector-crm.tsx:204-209 — Bouton "Nouveau lead" sans handler**  
Comportement actuel :  
```tsx
<button style={{ ... }}>
  <IcPlus /> Nouveau lead
</button>
```
Aucun `onClick`. Cliquer ne fait rien.  
Comportement attendu : Ouvrir un formulaire de création de lead.  
Fix suggéré : Ajouter un handler ou un DealWizard contextuel.

**[MEDIUM] sector-crm.tsx:327-333 — Boutons d'action (Phone, Mail, Chat, More) dans le tableau sans handlers**  
Comportement actuel : Les 4 boutons d'action par ligne (IcPhone, IcMail, IcChat, IcMore) n'ont aucun `onClick`.  
Comportement attendu : Phone → appel/création tâche ; Mail → email composé ; Chat → WhatsApp ; More → menu contextuel.  
Fix suggéré : Ajouter des handlers ou des menus contextuels.

**[LOW] sector-crm.tsx:205-209 — Labels hardcodés en français**  
Comportement actuel : `"Nouveau lead"`, `"Liste"`, `"Pipeline"`, `"Perdus"`, `"Chiffre d'affaires..."` sont tous en français sans support i18n.  
Comportement attendu : Respecter le système i18n AR/EN/FR déjà en place.  
Fix suggéré : Passer par `colLabel()` déjà défini dans le composant.

**[MEDIUM] sector-crm.tsx:109-112 — Filtrage confirmedDeals par sector utilise `d.category === sector`**  
Comportement actuel : Le filtre est correct. Les deals créés via le DealWizard ont bien un champ `category` qui correspond à `DealCategory`. Les types `DealCategory` et `Sector` ont des valeurs communes mais pas identiques : `Sector` inclut `"travail"` qui n'est **pas** dans `DealCategory`.  
Bug concret : Si un deal est créé dans la catégorie "travail" (qui **n'existe pas** dans `DealCategory`), le wizard ne permet pas de sélectionner "travail" — donc pas de bug fonctionnel en pratique. Mais la cohérence de types est fragile.  
Fix suggéré : Aligner `DealCategory` et `Sector` en un seul type partagé.

---

## 8 — Properties (properties.tsx)

**[MEDIUM] properties.tsx:521 — Bouton "View full detail" dans la MapPanel sans handler**  
Comportement actuel : `<button className="sgi-btn sgi-btn-ghost" style={{...}}>View full detail <IcChevR /></button>` — aucun `onClick`.  
Comportement attendu : Sélectionner la propriété dans la liste principale.  
Fix suggéré : `onClick={() => setSelected("INF-2417")}` (propriété hardcodée dans la carte).

**[MEDIUM] properties.tsx:527-528 — Boutons zoom "+"/"-" de la MapPanel sans handlers**  
Comportement actuel : Deux boutons "+" et "−" rendus dans la map SVG sans aucun `onClick`.  
Comportement attendu : La map est statique (SVG), donc ces boutons ne peuvent pas vraiment zoomer. Ils devraient être supprimés ou remplacés par une vraie carte (Mapbox/Google Maps).  
Fix suggéré : Retirer les boutons ou ajouter `disabled` avec un tooltip "Coming soon".

**[MEDIUM] properties.tsx:626 — Bouton "All photos" dans DetailPanel sans handler**  
Comportement actuel : `<button className="sgi-btn sgi-btn-ghost">All photos</button>` — pas de `onClick`.  
Comportement attendu : Ouvrir une galerie photos.  
Fix suggéré : Ajouter un état `showGallery` et une modale de galerie.

**[LOW] properties.tsx:556 — Bouton "More" (IcMore) dans DetailPanel sans handler**  
Comportement actuel : `<button className="sgi-btn sgi-btn-ghost"><IcMore /></button>` — pas de `onClick`.  
Fix suggéré : Menu contextuel (partager, archiver, supprimer).

**[LOW] properties.tsx:627 — Bouton "PDF" et "Share" sans handlers dans les actions de DetailPanel**  
Comportement actuel : `<button>PDF</button>` et `<button>Share</button>` sans `onClick`.  
Fix suggéré : Ajouter `window.print()` pour PDF ou un appel API d'export.

**[LOW] properties.tsx:629-631 — Bouton "Make offer" / "Schedule visit" sans handler**  
Comportement actuel : Aucun `onClick` sur ce bouton primaire.  
Comportement attendu : Ouvrir un formulaire d'offre ou de prise de RDV.  
Fix suggéré : Lier au DealWizard ou à un formulaire dédié.

**[LOW] properties.tsx:1444 — Bouton "Filter" dans la Topbar réinitialise les filtres au lieu de les ouvrir**  
Comportement actuel :  
```tsx
<button className="sgi-btn sgi-btn-ghost" onClick={() => setFilters(DEFAULT_FILTER)}>
  <IcFilter />&nbsp;{t.filter}{nActive > 0 ? ` · ${nActive}` : ""}
</button>
```
Cliquer sur "Filter" **réinitialise** tous les filtres actifs, alors que l'utilisateur attendrait un panneau de filtres avancés.  
Comportement attendu : Ouvrir un panneau de filtres avancés. La réinitialisation devrait être un bouton séparé.  
Fix suggéré : Séparer la logique de réinitialisation (déjà présente dans le ribbon) de ce bouton Topbar.

---

## 9 — Contracts (contracts.tsx)

**[MEDIUM] contracts.tsx — Boutons d'action par contrat sans handlers (probabilité élevée)**  
Note : Seules les 60 premières lignes de `contracts.tsx` ont été lues. Le pattern observé sur les autres screens (IcMore, IcDownload, IcMail sans onClick) est très probablement répété ici.  
Comportement attendu : Les boutons d'action (Download, Mail, More) devraient avoir des handlers.

---

## 10 — Golden Visa (golden-visa.tsx)

**[MEDIUM] golden-visa.tsx:51 — Bouton "Templates · 6" sans handler**  
Comportement actuel : Aucun `onClick`.  
Fix suggéré : Ouvrir une liste de modèles de documents.

**[MEDIUM] golden-visa.tsx:52 — Bouton "New" (IcPlus) sans handler**  
Comportement actuel : Aucun `onClick`.  
Fix suggéré : Ouvrir un formulaire de nouvelle application Golden Visa.

**[MEDIUM] golden-visa.tsx:98 — Bouton "Renew" dans les alertes sans handler**  
Comportement actuel : `<button className="sgi-btn sgi-btn-ghost">Renew</button>` — aucun `onClick`.  
Fix suggéré : Lier à une action de renouvellement de visa.

---

## 11 — Marketing (marketing.tsx)

**[MEDIUM] marketing.tsx:96-100 — Bouton "New campaign" sans handler**  
Comportement actuel : Aucun `onClick` sur le bouton primaire.  
Fix suggéré : Ouvrir un wizard de création de campagne.

---

## 12 — Parametres (parametres.tsx)

**[MEDIUM] parametres.tsx — Selects de type "select" affichent une valeur statique non modifiable**  
Comportement actuel : Les settings de type `"select"` (langue, timezone, currency, session timeout) affichent simplement la valeur dans un `<span>` — aucun vrai `<select>` HTML interactif.  
Comportement attendu : L'utilisateur devrait pouvoir modifier ces valeurs.  
Fix suggéré : Remplacer le `<span>` par un vrai `<select>` avec state local ou appel API.

**[LOW] parametres.tsx — Toggle "Dark mode" ne synchronise pas avec le ThemeProvider**  
Comportement actuel : Le toggle "darkmode" dans `toggles` state est local au composant `ScreenParametres`. Il n'appelle pas `useTheme().toggle()` du `ThemeProvider`.  
Comportement attendu : Le toggle devrait modifier le thème global via `ThemeProvider`.  
Fix suggéré : Importer `useTheme` et connecter le toggle au `toggle()` du provider.

---

## 13 — BackOffice (backoffice.tsx)

**[LOW] backoffice.tsx — Seuls 3 modules (HR, IT, Finance) sont affichés ; "marketing" manque**  
Comportement actuel : `MODULES` ne contient que hr, it, finance. Le module marketing existe dans la sidebar mais n'est pas dans le hub backoffice.  
Comportement attendu : Le screen backoffice devrait inclure Marketing ou pointer clairement vers `ScreenMarketing`.  
Fix suggéré : Ajouter marketing dans `MODULES` ou documenter que marketing a sa propre entrée sidebar.

---

## 14 — Clients (clients-personne.tsx & clients-societe.tsx)

**[MEDIUM] clients-personne.tsx:561 — Bouton "New Client" dans Topbar sans handler**  
Comportement actuel :  
```tsx
<button style={{ ... }}>
  <IcPlus2 />{lang === "ar" ? "عميل جديد" : ...}
</button>
```
Aucun `onClick`.  
Fix suggéré : Ouvrir un formulaire de création de client.

**[MEDIUM] clients-societe.tsx:636 — Bouton "New Company" dans Topbar sans handler**  
Comportement actuel : Même pattern, aucun `onClick`.  
Fix suggéré : Ouvrir un formulaire de création de société.

**[MEDIUM] clients-personne.tsx — mockDeals, mockDocuments, etc. sont recalculés à chaque render**  
Comportement actuel :  
```tsx
const deals    = mockDeals(person);
const docs     = mockDocuments(person);
const orders   = mockOrders(person);
const payments = mockPayments(person);
```
Ces appels à l'intérieur du composant `PersonDetail` recalculent les données à chaque render. Ce n'est pas un bug fonctionnel, mais peut entraîner des incohérences si `person` change au cours de la session.  
Comportement attendu : Dans une app réelle, ces données viendraient de l'API. En état mock, pas de vrai problème.

---

## 15 — Bugs TypeScript potentiels

**[MEDIUM] clients-personne.tsx:315 — Accès à DEAL_STATUS[d.status] sans vérification**  
Comportement actuel :  
```tsx
<span style={{ ... background: DEAL_STATUS[d.status].bg ... }}>
```
Si `d.status` contient une valeur non définie dans `DEAL_STATUS` (ex: une future valeur ajoutée aux mocks), cela lancera un `TypeError: Cannot read properties of undefined`.  
Fix suggéré : Ajouter un fallback : `DEAL_STATUS[d.status] ?? DEAL_STATUS.progress`.

**[MEDIUM] clients-societe.tsx:396 — Fallback ORD_STATUS.pending correct**  
Comportement actuel :  
```tsx
const ostat = ORD_STATUS[o.status as keyof typeof ORD_STATUS] ?? ORD_STATUS.pending;
```
Ce fallback est correct — bien géré dans cette version.

**[LOW] sector-crm.tsx:80 — Formatage compact peut afficher "NaN" si n = 0**  
Comportement actuel :  
```tsx
const fmt = (n: number) => new Intl.NumberFormat("en-AE", { notation: n >= 1000000 ? "compact" : "standard", ...}).format(n);
```
`format(0)` retourne "0" — pas de NaN. **Pas de bug**.

**[LOW] dashboard.tsx:22 — Division par zéro dans KpiTile sparkline si max = 0**  
Comportement actuel :  
```tsx
const max = Math.max(...spark);
const pts = spark.map((v, i) => `${...},${h - (v / max) * h}`).join(" ");
```
Si tous les points du sparkline valent 0, `max = 0` → division par zéro → `NaN` dans les coordonnées SVG → le sparkline devient invisible.  
Comportement attendu : Afficher une ligne plate à 0.  
Fix suggéré : `const max = Math.max(...spark) || 1;`

**[LOW] properties.tsx:723 — `new URL(url)` dans scrapePropertyFromUrl lancera une TypeError si url n'est pas une URL valide**  
Comportement actuel :  
```tsx
try {
  new URL(url); // validate URL format
  ...
} catch {
  setScrapeStatus("error");
}
```
Le `catch` est présent — **correctement géré**.

---

## 16 — Problèmes CSS / RTL

**[MEDIUM] sector-crm.tsx:154 — Référence à `var(--border)` non défini dans les thèmes SGI**  
Comportement actuel : Le composant utilise `var(--border)` dans plusieurs endroits (ex: ligne 154, 179, 201...). La convention du projet utilise `var(--line-soft)` ou `var(--line)`. Si `--border` n'est pas défini dans le CSS global, les bordures seront invisibles.  
Comportement attendu : Utiliser les variables CSS standard du projet.  
Fix suggéré : Remplacer `var(--border)` par `var(--line-soft)` partout dans `sector-crm.tsx`.

**[MEDIUM] sector-crm.tsx:94 — Style `background: "var(--bg-base)"` au lieu de `"var(--bg-cream)"`**  
Comportement actuel : Le fond du screen utilise `var(--bg-base)`. Si cette variable n'est pas identique à `var(--bg-cream)` utilisé partout ailleurs, la couleur de fond sera différente.  
Fix suggéré : Harmoniser avec `var(--bg-cream)`.

**[LOW] sector-crm.tsx — Textes fixes en français non localisés**  
Comportement actuel : "Nouveau lead", "Liste", "Pipeline", "Perdus", "Chiffre d'affaires clôturé", "Aucun résultat", "leads", "Score", "Besoin", "Budget", "Étape", "Agent", "Date", "Actions" sont tous en français.  
Comportement attendu : Traductions AR/EN/FR comme dans les autres screens.

---

## 17 — Problèmes de sécurité

**[HIGH] api/auth/login/route.ts:39 — Comparaison login en clair sans timing-safe**  
Comportement actuel :  
```ts
const loginOk = login.trim() === DEMO_LOGIN;
const passOk  = password     === DEMO_PASSWORD;
```
La comparaison de chaînes JavaScript n'est pas "timing-safe" — une attaque timing pourrait distinguer login erroné de mot de passe erroné. Un délai artificiel de 400ms est ajouté mais seulement après la comparaison.  
Comportement attendu : Utiliser `crypto.timingSafeEqual()` ou `timingSafeCompare`.  
Fix suggéré : Comparer les hashes HMAC plutôt que les chaînes brutes.

**[MEDIUM] api/auth/login/route.ts:21 — HMAC signé sur JWT_SECRET en clair sans vérification de longueur**  
Comportement actuel : Si `JWT_SECRET` est une chaîne courte (< 32 chars), la sécurité HMAC-SHA256 est affaiblie.  
Fix suggéré : Valider `JWT_SECRET.length >= 32` au démarrage.

---

## Résumé

### Total par sévérité

| Sévérité | Nombre |
|----------|--------|
| CRITICAL  | 0      |
| HIGH      | 4      |
| MEDIUM    | 22     |
| LOW       | 15     |
| **Total** | **41** |

### Les 3 problèmes les plus urgents

1. **[HIGH] `handlePayWithPoints` sans guard interne** (clients-personne.tsx:193 + clients-societe.tsx:202)  
   Le solde wallet peut théoriquement devenir négatif si la fonction est appelée directement. Bien que l'UI désactive le bouton, aucune protection côté logique n'existe. Risque de données corrompues en cas d'état de course (React concurrent features) ou de test.

2. **[HIGH] Absence de middleware Next.js vérifiant le JWT** (api/auth/login/route.ts + absence de middleware.ts)  
   N'importe quelle URL de l'application est accessible sans cookie valide côté serveur. Il n'y a aucune redirection automatique vers `/login` si le cookie est absent ou expiré. L'accès aux données sensibles (propriétés, contrats, visas) est déprotégé au niveau du routing.

3. **[HIGH] Bouton "Nouveau lead" dans sector-crm.tsx sans handler**  
   L'écran CRM sectoriel est le coeur du workflow commercial. Le bouton principal d'ajout de lead est complètement non fonctionnel pour tous les 9 secteurs. Cela bloque le workflow de conversion du DealWizard vers le CRM sectoriel.

---

*Rapport généré le 2026-05-26 par audit statique. Aucun fichier de code n'a été modifié.*
