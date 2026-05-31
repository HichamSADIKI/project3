---
name: progression
description: Affiche dans le terminal un tableau de bord graphique du taux de réalisation de la tâche principale et de ses sous-tâches (barres de progression Unicode + pourcentages). À utiliser quand l'utilisateur demande l'avancement, le « taux de réalisation », « où on en est », ou automatiquement au début/à la fin de chaque phase d'une demande multi-étapes.
---

# Skill : progression
# Tableau de bord graphique du taux de réalisation — SGI

## Quand charger

- L'utilisateur demande explicitement l'avancement : « où on en est », « taux de réalisation », « avancement », « progression », « combien il reste ».
- **Automatiquement** au lancement d'une demande qui se découpe en plusieurs sous-tâches (≥ 2), puis **à chaque fin de phase/sous-tâche** terminée — pour donner un feedback visuel d'avancement (s'aligne avec le skill `dev-process`).
- Avant de demander le « go » d'une phase suivante, afficher l'état courant.

Ne pas charger pour : une demande triviale d'un seul fichier sans découpage en sous-tâches.

---

## Source de données

1. **Priorité** : appeler `TaskList` (outil harness) pour récupérer les tâches courantes et leur statut.
2. À défaut, utiliser la liste de tâches active dans le contexte (todos) ou le découpage explicite de la demande en cours.

Mapping **statut → pourcentage** par défaut (quand aucun % explicite n'est disponible) :

| Statut | % par défaut | Icône |
|---|---|---|
| `completed` / terminé | 100 % | ✅ |
| `in_progress` / en cours | 50 % (ajuster selon le travail réellement fait) | 🔄 |
| `pending` / à faire | 0 % | ⏳ |
| bloqué / `blocked` | 0 % | ❌ |
| en pause / `on_hold` | dernier % connu | ⏸️ |

Le pourcentage d'une sous-tâche `in_progress` doit être **estimé honnêtement** d'après le travail concret déjà réalisé (ex. 3 fichiers sur 5 → 60 %), pas figé à 50 %.

---

## Calcul du taux global

- **Taux global** = moyenne des pourcentages des sous-tâches (pondérée si des poids sont fournis, sinon égale).
- Afficher aussi le compteur `(terminées / total)`.
- Une tâche **bloquée** (❌) ne fait pas avancer le global mais est signalée distinctement.

---

## Rendu graphique (terminal)

Le terminal affiche du Markdown : utiliser **uniquement des caractères Unicode + emojis** (jamais de codes ANSI, qui ne s'affichent pas).

### Génération de la barre

- Largeur fixe : **12 caractères**.
- `rempli = round(pourcentage / 100 × 12)`.
- Caractère plein : `█` — caractère vide : `░`.
- Exemple : 68 % → `rempli = round(8.16) = 8` → `████████░░░░`.

### Gabarit de sortie (à reproduire exactement)

```
╭─ PROGRESSION ─────────────────────────────────────────────╮
│  Demande : <titre court de la demande principale>          │
├────────────────────────────────────────────────────────────┤
│  GLOBAL   ████████░░░░  68 %   (5/8 terminées)             │
├────────────────────────────────────────────────────────────┤
│  ✅ <sous-tâche 1>            ████████████ 100 %           │
│  🔄 <sous-tâche 2>            ███████░░░░░  60 %           │
│  ⏳ <sous-tâche 3>            ░░░░░░░░░░░░   0 %           │
│  ❌ <sous-tâche 4> (bloquée)  ░░░░░░░░░░░░   0 %           │
╰────────────────────────────────────────────────────────────╯
```

Règles de présentation :
- Aligner les barres verticalement (libellés tronqués à ~28 caractères si besoin).
- Le pourcentage est affiché à droite de la barre, sur 3 caractères + ` %`.
- La ligne `GLOBAL` est toujours en premier, en gras de fait par sa position.
- Sous le cadre, ajouter **au plus une ligne** de commentaire : prochaine action ou blocage à lever.

### Variante compacte (inline, sans cadre)

Quand l'utilisateur veut juste un rappel rapide ou dans un résumé de phase :

```
Progression — Demande : <titre>
GLOBAL ████████░░░░ 68 % (5/8)
  ✅ <t1> 100 %   🔄 <t2> 60 %   ⏳ <t3> 0 %   ❌ <t4> bloquée
```

---

## Comportement

1. Récupérer les tâches (`TaskList`) ou le découpage courant.
2. Calculer chaque % et le global.
3. Choisir le rendu : **cadre complet** par défaut ; **compact** si intégré dans un résumé de phase ou si > 10 sous-tâches.
4. Afficher le tableau, puis **une seule** ligne d'orientation (prochaine étape / blocage).
5. Ne jamais inventer de progression : si une tâche n'a pas démarré, c'est 0 %.

## Exemple concret (audit backend SGI)

```
╭─ PROGRESSION ─────────────────────────────────────────────╮
│  Demande : Corrections audit backend (4 failles)           │
├────────────────────────────────────────────────────────────┤
│  GLOBAL   ███░░░░░░░░░  25 %   (1/4 terminées)             │
├────────────────────────────────────────────────────────────┤
│  ✅ C4 · Routage Celery        ████████████ 100 %         │
│  ⏳ M1 · Bug géoloc PATCH      ░░░░░░░░░░░░   0 %         │
│  ⏳ C2 · Middleware audit       ░░░░░░░░░░░░   0 %         │
│  ⏳ C3 · Clé MFA                ░░░░░░░░░░░░   0 %         │
╰────────────────────────────────────────────────────────────╯
Prochaine action : M1 — corriger _make_point (properties/service.py:173).
```
