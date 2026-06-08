import { describe, expect, it } from "vitest";

import { detectScrapeSource, isSupportedListingUrl } from "./scrape-source";

describe("detectScrapeSource", () => {
  it("detects Bayut", () => {
    expect(detectScrapeSource("https://www.bayut.com/property/details-123.html")).toBe("bayut");
  });

  it("detects PropertyFinder", () => {
    expect(detectScrapeSource("https://www.propertyfinder.ae/en/plp/buy/apartment-1")).toBe(
      "propertyfinder",
    );
  });

  it("detects Dubizzle on the allowlisted hosts", () => {
    expect(detectScrapeSource("https://dubizzle.com/property-for-sale/x")).toBe("dubizzle");
    expect(detectScrapeSource("https://uae.dubizzle.com/property-for-sale/x")).toBe("dubizzle");
  });

  it("rejects a non-allowlisted Dubizzle regional subdomain (mirrors backend exact-match)", () => {
    // Le backend `_ALLOWED_HOSTS` n'inclut que dubizzle.com / uae.dubizzle.com.
    expect(detectScrapeSource("https://dubai.dubizzle.com/x")).toBeNull();
  });

  it("is case-insensitive on the host", () => {
    expect(detectScrapeSource("https://WWW.BAYUT.COM/abc")).toBe("bayut");
  });

  it("rejects an unsupported host", () => {
    expect(detectScrapeSource("https://example.com/listing")).toBeNull();
  });

  it("rejects a non-http scheme", () => {
    expect(detectScrapeSource("ftp://bayut.com/x")).toBeNull();
  });

  it("rejects a malformed URL", () => {
    expect(detectScrapeSource("not a url")).toBeNull();
    expect(detectScrapeSource("")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(detectScrapeSource("  https://bayut.com/x  ")).toBe("bayut");
  });
});

describe("isSupportedListingUrl", () => {
  it("is true for a supported site and false otherwise", () => {
    expect(isSupportedListingUrl("https://propertyfinder.ae/x")).toBe(true);
    expect(isSupportedListingUrl("https://google.com")).toBe(false);
  });
});
