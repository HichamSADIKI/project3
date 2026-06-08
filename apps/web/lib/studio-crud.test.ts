import { describe, expect, it } from "vitest";

import { blankValues, fieldColumns, slugOf } from "./studio-crud";
import type { SheetSchema } from "./studio-schema";

const SCHEMA: SheetSchema = {
  schema_version: 1,
  sheets: [
    {
      id: "main",
      title_ar: "a",
      title_en: "M",
      title_fr: "M",
      elements: [
        { id: "name", type: "text", label_ar: "ا", label_en: "Name", label_fr: "Nom", required: true },
        { id: "amount", type: "number", label_ar: "ا", label_en: "Amt", label_fr: "Mt" },
        { id: "active", type: "checkbox", label_ar: "ا", label_en: "Act", label_fr: "Act" },
        {
          id: "kind",
          type: "select",
          label_ar: "ا",
          label_en: "Kind",
          label_fr: "Type",
          options: [{ value: "new", label_ar: "ج", label_en: "New", label_fr: "Neuf" }],
        },
        { id: "id", type: "text", label_ar: "ا", label_en: "Id", label_fr: "Id" }, // réservé → f_id
        { id: "go", type: "button", label_ar: "ا", label_en: "Go", label_fr: "Go", action: "submit" },
        { id: "hdr", type: "label", label_ar: "ا", label_en: "H", label_fr: "H" },
      ],
    },
  ],
};

describe("slugOf", () => {
  it("remplace les points par des underscores (= module_slug backend)", () => {
    expect(slugOf("studio.inventory")).toBe("studio_inventory");
    expect(slugOf("abc")).toBe("abc");
  });
});

describe("fieldColumns (miroir de column_specs backend)", () => {
  const cols = fieldColumns(SCHEMA);
  const byName = Object.fromEntries(cols.map((c) => [c.name, c]));

  it("ignore label/button et préfixe les réservés (id → f_id)", () => {
    expect(cols.map((c) => c.name)).toEqual(["name", "amount", "active", "kind", "f_id"]);
  });
  it("conserve required + options + type", () => {
    expect(byName.name.required).toBe(true);
    expect(byName.amount.required).toBe(false);
    expect(byName.kind.type).toBe("select");
    expect(byName.kind.options).toHaveLength(1);
    expect(byName.kind.options[0].value).toBe("new");
  });
  it("fieldId conserve l'id d'origine même renommé", () => {
    expect(byName.f_id.fieldId).toBe("id");
  });
});

describe("blankValues", () => {
  it("checkbox → false, sinon chaîne vide", () => {
    const v = blankValues(fieldColumns(SCHEMA));
    expect(v.active).toBe(false);
    expect(v.name).toBe("");
    expect(v.kind).toBe("");
  });
});
