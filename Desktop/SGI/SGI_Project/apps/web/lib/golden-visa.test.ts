import { describe, it, expect } from "vitest";

import {
  clientLabel,
  docsProgress,
  daysUntil,
  expiryBucket,
  isEligibleAmount,
  docTypeFor,
  isImageOnly,
  acceptFor,
  GV_DOCS,
  GV_DOC_TYPE,
  GV_THRESHOLD_AED,
} from "./golden-visa";

describe("clientLabel", () => {
  it("nom de société", () => expect(clientLabel({ id: "x", company_name: "ACME FZE" }, "x")).toBe("ACME FZE"));
  it("personne (prénom + nom)", () =>
    expect(clientLabel({ id: "x", first_name: "Ali", last_name: "Ben" }, "x")).toBe("Ali Ben"));
  it("client absent → id court", () => expect(clientLabel(undefined, "abcd1234efgh")).toBe("#abcd1234"));
  it("client sans nom → id court", () => expect(clientLabel({ id: "x" }, "abcd1234efgh")).toBe("#abcd1234"));
});

const empty = {
  passport_doc: null,
  dld_doc: null,
  gdrfa_doc: null,
  insurance_doc: null,
  biometric_photo: null,
};

describe("docsProgress", () => {
  it("0/5", () => expect(docsProgress(empty)).toEqual({ done: 0, total: 5, complete: false }));
  it("5/5 complet", () => {
    const full = Object.fromEntries(GV_DOCS.map((k) => [k, "url"])) as Record<(typeof GV_DOCS)[number], string>;
    expect(docsProgress(full)).toEqual({ done: 5, total: 5, complete: true });
  });
  it("partiel", () =>
    expect(docsProgress({ ...empty, passport_doc: "u", dld_doc: "u" }).done).toBe(2));
});

describe("daysUntil", () => {
  const today = new Date("2026-06-10T12:00:00Z");
  it("date future", () => expect(daysUntil("2026-06-20", today)).toBe(10));
  it("date passée", () => expect(daysUntil("2026-06-01", today)).toBe(-9));
  it("null", () => expect(daysUntil(null, today)).toBeNull());
  it("invalide", () => expect(daysUntil("pas-une-date", today)).toBeNull());
});

describe("expiryBucket", () => {
  it("none", () => expect(expiryBucket(null)).toBe("none"));
  it("expired", () => expect(expiryBucket(-1)).toBe("expired"));
  it("j30", () => expect(expiryBucket(15)).toBe("j30"));
  it("j90", () => expect(expiryBucket(60)).toBe("j90"));
  it("ok", () => expect(expiryBucket(200)).toBe("ok"));
});

describe("isEligibleAmount", () => {
  it("≥ seuil", () => expect(isEligibleAmount(GV_THRESHOLD_AED)).toBe(true));
  it("< seuil", () => expect(isEligibleAmount(GV_THRESHOLD_AED - 1)).toBe(false));
  it("null", () => expect(isEligibleAmount(null)).toBe(false));
});

describe("docTypeFor / GV_DOC_TYPE", () => {
  it("mappe chaque colonne vers un doc_type backend", () => {
    expect(docTypeFor("passport_doc")).toBe("passport");
    expect(docTypeFor("biometric_photo")).toBe("biometric");
    expect(docTypeFor("dld_doc")).toBe("dld");
  });
  it("couvre les 5 colonnes", () => {
    expect(Object.keys(GV_DOC_TYPE).sort()).toEqual([...GV_DOCS].sort());
  });
});

describe("isImageOnly / acceptFor", () => {
  it("photo biométrique → image uniquement", () => {
    expect(isImageOnly("biometric_photo")).toBe(true);
    expect(acceptFor("biometric_photo")).toBe("image/*");
  });
  it("passeport → PDF ou image", () => {
    expect(isImageOnly("passport_doc")).toBe(false);
    expect(acceptFor("passport_doc")).toBe("application/pdf,image/*");
  });
});
