import { describe, expect, it } from "vitest";

import { scrapedToPropertyDraft, type ScrapedProperty } from "./scraped-to-property";

function make(overrides: Partial<ScrapedProperty> = {}): ScrapedProperty {
  return {
    title_en: "",
    price: "",
    prop_type: "apartment",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    emirate: "",
    community: "",
    description: "",
    images: [],
    source: "bayut",
    fields_found: 0,
    ...overrides,
  };
}

describe("scrapedToPropertyDraft", () => {
  it("rejects a listing without a usable price", () => {
    expect(scrapedToPropertyDraft(make({ price: "" }))).toEqual({ error: "missing_price" });
    expect(scrapedToPropertyDraft(make({ price: "Price on request" }))).toEqual({
      error: "missing_price",
    });
    expect(scrapedToPropertyDraft(make({ price: "0" }))).toEqual({ error: "missing_price" });
  });

  it("parses a formatted price with currency and thousands separators", () => {
    const r = scrapedToPropertyDraft(make({ price: "AED 2,340,000" }));
    expect("draft" in r && r.draft.price).toBe(2340000);
  });

  it("converts sqft to square metres (rounded to 2 decimals)", () => {
    const r = scrapedToPropertyDraft(make({ price: "1000000", sqft: "1,127 sqft" }));
    // 1127 * 0.092903 = 104.701... → 104.7
    expect("draft" in r && r.draft.area_sqm).toBe(104.7);
  });

  it("parses bedrooms / bathrooms as integers", () => {
    const r = scrapedToPropertyDraft(make({ price: "500000", bedrooms: "2", bathrooms: "3" }));
    if (!("draft" in r)) throw new Error("expected draft");
    expect(r.draft.bedrooms).toBe(2);
    expect(r.draft.bathrooms).toBe(3);
  });

  it("falls back to apartment for an unknown type and keeps allowed types", () => {
    expect(
      (scrapedToPropertyDraft(make({ price: "1", prop_type: "loft" })) as { draft: { type: string } })
        .draft.type,
    ).toBe("apartment");
    expect(
      (scrapedToPropertyDraft(make({ price: "1", prop_type: "villa" })) as { draft: { type: string } })
        .draft.type,
    ).toBe("villa");
  });

  it("maps emirate→city, community→district, title and description", () => {
    const r = scrapedToPropertyDraft(
      make({
        price: "1",
        title_en: "  Lovely flat  ",
        description: "Sea view",
        emirate: "Dubai",
        community: "Marina",
      }),
    );
    if (!("draft" in r)) throw new Error("expected draft");
    expect(r.draft.title_en).toBe("Lovely flat");
    expect(r.draft.description_en).toBe("Sea view");
    expect(r.draft.city).toBe("Dubai");
    expect(r.draft.district).toBe("Marina");
  });

  it("keeps only http(s) images and caps them", () => {
    const r = scrapedToPropertyDraft(
      make({
        price: "1",
        images: ["https://cdn/x.jpg", "http://cdn/y.png", "javascript:alert(1)", "data:foo", ""],
      }),
    );
    if (!("draft" in r)) throw new Error("expected draft");
    expect(r.draft.images).toEqual(["https://cdn/x.jpg", "http://cdn/y.png"]);
  });

  it("omits images when none are valid", () => {
    const r = scrapedToPropertyDraft(make({ price: "1", images: ["ftp://x", "not-a-url"] }));
    if (!("draft" in r)) throw new Error("expected draft");
    expect(r.draft.images).toBeUndefined();
  });

  it("omits optional fields that are empty or unparseable", () => {
    const r = scrapedToPropertyDraft(make({ price: "750000" }));
    if (!("draft" in r)) throw new Error("expected draft");
    expect(r.draft.area_sqm).toBeUndefined();
    expect(r.draft.bedrooms).toBeUndefined();
    expect(r.draft.title_en).toBeUndefined();
    expect(r.draft.city).toBeUndefined();
  });
});
