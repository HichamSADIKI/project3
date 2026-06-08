import { describe, expect, it } from "vitest";

import {
  blankElement,
  blankSheet,
  move,
  normalizeSchema,
  removeAt,
  replaceAt,
  slugify,
  uniqueSlug,
  type SheetSchema,
} from "./studio-schema";

describe("slugify", () => {
  it("borne au charset backend ^[a-z0-9_]+$", () => {
    expect(slugify("Mon Champ")).toBe("mon_champ");
    expect(slugify("Téléphone N°2")).toBe("telephone_n_2");
    expect(slugify("  --A--  ")).toBe("a");
  });
  it("repli 'field' si vide", () => {
    expect(slugify("")).toBe("field");
    expect(slugify("???")).toBe("field");
  });
});

describe("uniqueSlug", () => {
  it("suffixe en cas de collision", () => {
    expect(uniqueSlug("name", [])).toBe("name");
    expect(uniqueSlug("name", ["name"])).toBe("name_2");
    expect(uniqueSlug("name", ["name", "name_2"])).toBe("name_3");
  });
});

describe("blankElement", () => {
  it("bouton → action submit par défaut", () => {
    const b = blankElement("button");
    expect(b.type).toBe("button");
    expect(b.action).toBe("submit");
  });
  it("select → options vides", () => {
    expect(blankElement("select").options).toEqual([]);
  });
  it("text → pas d'action ni options", () => {
    const t = blankElement("text");
    expect(t.action).toBeUndefined();
    expect(t.options).toBeUndefined();
  });
});

describe("helpers de liste immuables", () => {
  it("move réordonne sans muter", () => {
    const a = [1, 2, 3];
    expect(move(a, 0, 2)).toEqual([2, 3, 1]);
    expect(a).toEqual([1, 2, 3]); // non muté
    expect(move(a, 0, 5)).toBe(a); // hors borne → identité
  });
  it("removeAt / replaceAt", () => {
    expect(removeAt([1, 2, 3], 1)).toEqual([1, 3]);
    expect(replaceAt([1, 2, 3], 1, 9)).toEqual([1, 9, 3]);
  });
});

describe("normalizeSchema", () => {
  it("remplit + dédoublonne les ids et nettoie les champs par type", () => {
    const schema: SheetSchema = {
      schema_version: 1,
      sheets: [
        {
          id: "",
          title_ar: "ص",
          title_en: "Main",
          title_fr: "Principale",
          elements: [
            { id: "", type: "text", label_ar: "أ", label_en: "Name", label_fr: "Nom" },
            { id: "", type: "text", label_ar: "ب", label_en: "Name", label_fr: "Nom" },
            {
              id: "go",
              type: "button",
              label_ar: "إرسال",
              label_en: "Submit",
              label_fr: "Envoyer",
            },
          ],
        },
      ],
    };
    const out = normalizeSchema(schema);
    expect(out.sheets[0].id).toBe("main");
    const ids = out.sheets[0].elements.map((e) => e.id);
    expect(ids[0]).toBe("name");
    expect(ids[1]).toBe("name_2"); // dédoublonné
    expect(new Set(ids).size).toBe(ids.length); // tous uniques
    // Le bouton conserve une action ; un champ texte n'a ni action ni options.
    expect(out.sheets[0].elements[2].action).toBe("submit");
    expect(out.sheets[0].elements[0].action).toBeUndefined();
  });

  it("une feuille vierge passe la normalisation", () => {
    const out = normalizeSchema({ schema_version: 1, sheets: [blankSheet(0)] });
    expect(out.sheets[0].elements.length).toBeGreaterThanOrEqual(1);
    expect(out.sheets[0].elements[0].id).toBeTruthy();
  });
});
