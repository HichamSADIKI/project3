import { describe, it, expect } from "vitest";

import {
  topLevelEntries,
  findGroup,
  domainOfScreen,
  groupBySection,
  isTopLevelItem,
  type NavModelEntry,
} from "./nav-model";

// Fixture représentatif (mêmes formes que NAV_ENTRIES, sans icônes).
const ENTRIES: NavModelEntry[] = [
  { type: "item", key: "dash" },
  {
    type: "group",
    id: "clients",
    groupKey: "clients",
    children: [
      { key: "personne" },
      { key: "societe" },
    ],
  },
  {
    type: "group",
    id: "realestate",
    groupKey: "realestate",
    children: [
      { key: "crm", section: "commercial" },
      { key: "realestate_vente", section: "commercial" },
      { key: "realestate_buildings", section: "patrimoine" },
      { key: "realestate_owners", section: "tiers" },
    ],
  },
  { type: "spacer", id: "spacer-1" },
  { type: "item", key: "parametres" },
];

describe("topLevelEntries", () => {
  it("exclut les séparateurs, garde items + groupes", () => {
    const top = topLevelEntries(ENTRIES);
    expect(top.map((e) => e.type)).toEqual(["item", "group", "group", "item"]);
    expect(top.some((e) => e.type === "spacer")).toBe(false);
  });
});

describe("findGroup", () => {
  it("trouve un groupe par id", () => {
    const g = findGroup(ENTRIES, "realestate");
    expect(g).not.toBeNull();
    expect(g?.children).toHaveLength(4);
  });
  it("renvoie null pour un id inconnu", () => {
    expect(findGroup(ENTRIES, "nope")).toBeNull();
  });
});

describe("domainOfScreen", () => {
  it("écran enfant → id de sa rubrique", () => {
    expect(domainOfScreen(ENTRIES, "realestate_vente")).toBe("realestate");
    expect(domainOfScreen(ENTRIES, "personne")).toBe("clients");
  });
  it("clé de groupe elle-même → id du groupe", () => {
    expect(domainOfScreen(ENTRIES, "realestate")).toBe("realestate");
  });
  it("item de premier niveau → null (pas de rubrique)", () => {
    expect(domainOfScreen(ENTRIES, "dash")).toBeNull();
    expect(domainOfScreen(ENTRIES, "parametres")).toBeNull();
  });
  it("clé inconnue → null", () => {
    expect(domainOfScreen(ENTRIES, "xyz")).toBeNull();
  });
});

describe("groupBySection", () => {
  it("regroupe les items consécutifs par section, ordre conservé", () => {
    const g = findGroup(ENTRIES, "realestate")!;
    const blocks = groupBySection(g.children);
    expect(blocks.map((b) => b.section)).toEqual(["commercial", "patrimoine", "tiers"]);
    expect(blocks[0].items.map((i) => i.key)).toEqual(["crm", "realestate_vente"]);
  });
  it("items sans section → bloc unique section:null", () => {
    const g = findGroup(ENTRIES, "clients")!;
    const blocks = groupBySection(g.children);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].section).toBeNull();
    expect(blocks[0].items).toHaveLength(2);
  });
});

describe("isTopLevelItem", () => {
  it("reconnaît les items de premier niveau", () => {
    expect(isTopLevelItem(ENTRIES, "dash")).toBe(true);
    expect(isTopLevelItem(ENTRIES, "parametres")).toBe(true);
  });
  it("un enfant de rubrique n'est pas un item de premier niveau", () => {
    expect(isTopLevelItem(ENTRIES, "personne")).toBe(false);
    expect(isTopLevelItem(ENTRIES, "realestate")).toBe(false);
  });
});
