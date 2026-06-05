/**
 * nav-model — helpers purs de dérivation du modèle de navigation.
 *
 * Source unique = `NAV_ENTRIES` (défini dans components/sgi-ui.tsx, avec icônes).
 * Ces fonctions sont génériques et structurelles : elles n'importent PAS sgi-ui
 * (donc pas de React), restent pures et testables en environnement Node, et
 * préservent les champs supplémentaires (ex. `icon`) via les génériques.
 *
 * Utilisées par le hub de navigation (cartes L1/L2) et par le shell (scoping de
 * la sidebar au domaine de l'écran actif en L3).
 */

export interface NavModelItem {
  key: string;
  section?: string;
  labelKey?: string;
  badge?: number;
}
export interface NavModelGroup {
  type: "group";
  id: string;
  groupKey: string;
  children: NavModelItem[];
}
export interface NavModelSingle {
  type: "item";
  key: string;
}
export interface NavModelSpacer {
  type: "spacer";
  id: string;
}
export type NavModelEntry = NavModelGroup | NavModelSingle | NavModelSpacer;

/** Entrées de premier niveau (rubriques + items), hors séparateurs. */
export function topLevelEntries<E extends NavModelEntry>(entries: readonly E[]): E[] {
  return entries.filter((e): e is E => e.type !== "spacer");
}

/** Récupère un groupe (rubrique) par son `id`, en préservant son type concret (icônes incluses). */
export function findGroup<E extends NavModelEntry>(
  entries: readonly E[],
  id: string,
): Extract<E, { type: "group" }> | null {
  for (const e of entries) {
    if (e.type === "group" && e.id === id) return e as Extract<E, { type: "group" }>;
  }
  return null;
}

/**
 * Domaine (id de rubrique) auquel appartient un écran — pour limiter la sidebar
 * aux fonctions de la rubrique en niveau page (L3). Renvoie null pour un item de
 * premier niveau (Dashboard/Rapports/Paramètres) ou une clé inconnue.
 */
export function domainOfScreen(entries: readonly NavModelEntry[], screenKey: string): string | null {
  for (const e of entries) {
    if (e.type === "group") {
      if (e.groupKey === screenKey) return e.id;
      if (e.children.some((c) => c.key === screenKey)) return e.id;
    }
  }
  return null;
}

/**
 * Regroupe des items consécutifs par `section` (pôle), en conservant l'ordre.
 * Un item sans section forme un bloc `section: null`. Préserve le type concret
 * des items (icônes incluses) via le générique.
 */
export function groupBySection<I extends NavModelItem>(
  items: readonly I[],
): { section: string | null; items: I[] }[] {
  const blocks: { section: string | null; items: I[] }[] = [];
  for (const it of items) {
    const sec = it.section ?? null;
    const last = blocks[blocks.length - 1];
    if (last && last.section === sec) last.items.push(it);
    else blocks.push({ section: sec, items: [it] });
  }
  return blocks;
}

/** Vrai si l'écran est un item de premier niveau (pas dans une rubrique). */
export function isTopLevelItem(entries: readonly NavModelEntry[], screenKey: string): boolean {
  return entries.some((e) => e.type === "item" && e.key === screenKey);
}
