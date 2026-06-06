import { describe, it, expect } from "vitest";

import {
  propertyTitle,
  formatPriceAED,
  formatDistance,
  toMarkers,
  type RadiusProperty,
} from "./properties-map";

const base: RadiusProperty = {
  id: "p1",
  reference: "REF-1",
  type: "apartment",
  title_en: null,
  title_fr: null,
  title_ar: null,
  price: 1500000,
  bedrooms: 2,
  city: "Dubai",
  status: "available",
  latitude: 25.2,
  longitude: 55.27,
  dist_m: 350,
};

describe("propertyTitle", () => {
  it("préfère title_en puis fr/ar, repli référence", () => {
    expect(propertyTitle({ ...base, title_en: "Marina Villa" })).toBe("Marina Villa");
    expect(propertyTitle({ ...base, title_fr: "Villa" })).toBe("Villa");
    expect(propertyTitle(base)).toBe("REF-1");
  });
});

describe("formatPriceAED", () => {
  it("formate en AED chiffres latins", () => {
    expect(formatPriceAED(1500000)).toMatch(/1,500,000/);
    expect(formatPriceAED("2000000")).toMatch(/2,000,000/);
  });
  it("tiret si null/vide/NaN", () => {
    expect(formatPriceAED(null)).toBe("—");
    expect(formatPriceAED("")).toBe("—");
    expect(formatPriceAED("abc")).toBe("—");
  });
});

describe("formatDistance", () => {
  it("mètres sous 1 km", () => expect(formatDistance(350)).toBe("350 m"));
  it("kilomètres au-delà", () => expect(formatDistance(2500)).toBe("2.5 km"));
  it("vide si invalide", () => expect(formatDistance(-1)).toBe(""));
});

describe("toMarkers", () => {
  it("mappe les biens géolocalisés en marqueurs", () => {
    const m = toMarkers([{ ...base, title_en: "Tower" }]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ id: "p1", lat: 25.2, lng: 55.27, title: "Tower" });
    expect(m[0].subtitle).toContain("Dubai");
    expect(m[0].badge).toBe("350 m");
  });
  it("exclut les biens sans coordonnées", () => {
    const m = toMarkers([{ ...base, latitude: null, longitude: null }]);
    expect(m).toHaveLength(0);
  });
});
