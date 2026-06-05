import { describe, it, expect } from "vitest";

import { screenForEntity, emojiForEntity, toSearchItems, type EntityHit } from "./entity-search";

describe("screenForEntity", () => {
  it("biens → catalogue immobilier", () => expect(screenForEntity("property")).toBe("realestate"));
  it("contrats → écran contrats", () =>
    expect(screenForEntity("contract")).toBe("realestate_contracts"));
  it("clients → personnes", () => expect(screenForEntity("client")).toBe("personne"));
  it("inconnu → repli realestate", () => expect(screenForEntity("???")).toBe("realestate"));
});

describe("emojiForEntity", () => {
  it("a un emoji par type connu", () => {
    expect(emojiForEntity("property")).toBe("🏠");
    expect(emojiForEntity("client")).toBe("👤");
    expect(emojiForEntity("contract")).toBe("📄");
  });
  it("repli pour type inconnu", () => expect(emojiForEntity("x")).toBe("🔎"));
});

describe("toSearchItems", () => {
  const hits: EntityHit[] = [
    { entity_type: "client", id: "c1", label: "ACME", subtitle: "a@b.co", reference: null },
    { entity_type: "property", id: "p1", label: "Villa", subtitle: "Dubai", reference: "REF-1" },
    { entity_type: "contract", id: "k1", label: "CT-1", subtitle: "active", reference: "CT-1" },
  ];
  const items = toSearchItems(hits);

  it("mappe tous les hits en items catégorie result", () => {
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.category === "result")).toBe(true);
  });

  it("client : initialSearch posé (ouvre l'écran filtré)", () => {
    const c = items[0];
    expect(c.initialSearch).toBe("ACME");
    expect(c.screen).toBe("personne");
    expect(c.sub).toBe("a@b.co");
  });

  it("bien : pas d'initialSearch, sub = subtitle, id préfixé live", () => {
    const p = items[1];
    expect(p.initialSearch).toBeUndefined();
    expect(p.screen).toBe("realestate");
    expect(p.id).toBe("live-property-p1");
  });

  it("sub retombe sur reference si subtitle absent", () => {
    const [only] = toSearchItems([
      { entity_type: "contract", id: "k2", label: "CT-2", subtitle: null, reference: "CT-2" },
    ]);
    expect(only.sub).toBe("CT-2");
  });
});
