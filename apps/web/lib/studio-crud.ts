/**
 * Helpers PURS pour l'écran générique des modules générés (3B+ C).
 *
 * `fieldColumns` **porte la même logique de nommage que le backend `column_specs`**
 * (`apps/api/app/routers/admin/studio_templates.py`) : réservés → préfixe `f_`,
 * dédoublonnage, types d'éléments retenus. Garantit que les clés de payload du
 * formulaire correspondent aux champs `Create` du module généré. Testé sous vitest.
 */

import type { SelectOption, SheetSchema } from "@/lib/studio-schema";

export type CrudType = "text" | "textarea" | "number" | "date" | "checkbox" | "select";

export type CrudColumn = {
  name: string; // nom de colonne backend = clé de payload
  fieldId: string; // id d'élément d'origine
  type: CrudType;
  label_ar: string;
  label_en: string;
  label_fr: string;
  required: boolean;
  options: SelectOption[];
};

// Doit rester aligné sur le backend (studio_templates._RESERVED / _TYPE_MAP).
const RESERVED = new Set(["id", "company_id", "created_at", "updated_at", "deleted_at"]);
const FIELD_TYPES = new Set<CrudType>([
  "text",
  "textarea",
  "number",
  "date",
  "checkbox",
  "select",
]);

/** slug identifiant = clé du module avec les points → underscores (= module_slug backend). */
export function slugOf(key: string): string {
  return key.replace(/\./g, "_");
}

/** Colonnes CRUD dérivées du SheetSchema (toutes feuilles aplaties). label/button ignorés. */
export function fieldColumns(schema: SheetSchema): CrudColumn[] {
  const used = new Set<string>();
  const cols: CrudColumn[] = [];
  for (const sheet of schema.sheets ?? []) {
    for (const el of sheet.elements ?? []) {
      if (!FIELD_TYPES.has(el.type as CrudType)) continue; // label/button
      const fid = el.id || "";
      if (!fid) continue;
      let name = RESERVED.has(fid) ? `f_${fid}` : fid;
      const base = name;
      let i = 2;
      while (used.has(name)) {
        name = `${base}_${i}`;
        i += 1;
      }
      used.add(name);
      cols.push({
        name,
        fieldId: fid,
        type: el.type as CrudType,
        label_ar: el.label_ar,
        label_en: el.label_en,
        label_fr: el.label_fr,
        required: !!el.required,
        options: el.options ?? [],
      });
    }
  }
  return cols;
}

/** Valeurs vierges d'un formulaire (checkbox → false, sinon chaîne vide). */
export function blankValues(cols: CrudColumn[]): Record<string, string | boolean> {
  const v: Record<string, string | boolean> = {};
  for (const c of cols) v[c.name] = c.type === "checkbox" ? false : "";
  return v;
}
