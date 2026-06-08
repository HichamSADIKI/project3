/**
 * Types + helpers PURS du `SheetSchema` du Studio (partagés builder/renderer).
 *
 * Miroir du schéma backend (`apps/api/app/routers/admin/studio_schema.py`) : feuilles
 * → éléments → actions. Aucune dépendance React → testable sous vitest (env node).
 * Le builder visuel (Phase 2) produit exactement le même `SheetSchema` que la saisie
 * JSON brute ou la génération IA.
 */

export type ElementType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date"
  | "label"
  | "button";

export type ButtonAction = "submit" | "reset" | "navigate";

export type SelectOption = {
  value: string;
  label_ar: string;
  label_en: string;
  label_fr: string;
};

export type Element = {
  id: string;
  type: ElementType;
  label_ar: string;
  label_en: string;
  label_fr: string;
  placeholder?: string | null;
  required?: boolean;
  options?: SelectOption[];
  action?: ButtonAction | null;
};

export type Sheet = {
  id: string;
  title_ar: string;
  title_en: string;
  title_fr: string;
  elements: Element[];
};

export type SheetSchema = {
  schema_version: number;
  sheets: Sheet[];
};

export const ELEMENT_TYPES: ElementType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "checkbox",
  "date",
  "label",
  "button",
];

export const BUTTON_ACTIONS: ButtonAction[] = ["submit", "reset", "navigate"];

/** Slug `^[a-z0-9_]+$` borné à 60 (aligné sur la contrainte backend). "field" si vide. */
export function slugify(s: string): string {
  const out = (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return out || "field";
}

/** Slug unique vis-à-vis de `existing` (suffixe _2, _3, …). */
export function uniqueSlug(base: string, existing: string[]): string {
  const root = slugify(base);
  if (!existing.includes(root)) return root;
  let n = 2;
  while (existing.includes(`${root}_${n}`)) n += 1;
  return `${root}_${n}`;
}

/** Élément vierge avec valeurs par défaut propres au type (options/action). id vide. */
export function blankElement(type: ElementType = "text"): Element {
  if (type === "button") {
    return {
      id: "",
      type,
      label_ar: "إرسال",
      label_en: "Submit",
      label_fr: "Envoyer",
      action: "submit",
    };
  }
  const el: Element = { id: "", type, label_ar: "حقل", label_en: "Field", label_fr: "Champ" };
  if (type === "select") el.options = [];
  return el;
}

/** Feuille vierge avec un champ texte. `index` sert au titre/slug par défaut. */
export function blankSheet(index = 0): Sheet {
  const n = index + 1;
  return {
    id: `sheet_${n}`,
    title_ar: "صفحة",
    title_en: `Sheet ${n}`,
    title_fr: `Feuille ${n}`,
    elements: [{ ...blankElement("text"), id: "field_1" }],
  };
}

export function emptySchema(): SheetSchema {
  return { schema_version: 1, sheets: [blankSheet(0)] };
}

// ── Helpers de liste immuables (réutilisés par le builder) ─────────────────

export function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= arr.length || from < 0 || from >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, j) => j !== i);
}

export function replaceAt<T>(arr: T[], i: number, value: T): T[] {
  return arr.map((x, j) => (j === i ? value : x));
}

/**
 * Garantit un `SheetSchema` exportable : ids non vides + uniques (dérivés des
 * libellés si besoin), `options`/`action` cohérents avec le type. Pur — appelé
 * avant sérialisation/sauvegarde pour que la sortie passe la validation backend.
 */
export function normalizeSchema(schema: SheetSchema): SheetSchema {
  const sheetIds: string[] = [];
  const sheets = schema.sheets.map((sheet, si) => {
    const sid = uniqueSlug(sheet.id || sheet.title_en || `sheet_${si + 1}`, sheetIds);
    sheetIds.push(sid);
    const elIds: string[] = [];
    const elements = sheet.elements.map((el) => {
      const eid = uniqueSlug(el.id || el.label_en || el.type, elIds);
      elIds.push(eid);
      const out: Element = {
        id: eid,
        type: el.type,
        label_ar: el.label_ar,
        label_en: el.label_en,
        label_fr: el.label_fr,
      };
      if (el.placeholder) out.placeholder = el.placeholder;
      if (el.required) out.required = true;
      if (el.type === "select") out.options = el.options ?? [];
      if (el.type === "button") out.action = el.action ?? "submit";
      return out;
    });
    return { id: sid, title_ar: sheet.title_ar, title_en: sheet.title_en, title_fr: sheet.title_fr, elements };
  });
  return { schema_version: 1, sheets };
}
