import { describe, it, expect } from "vitest";

import { clientLabel, dayBucket, isUpcoming, AGENDA_TYPES, AGENDA_STATUSES } from "./agenda";

describe("clientLabel", () => {
  it("société", () => expect(clientLabel({ id: "x", company_name: "ACME" }, "x")).toBe("ACME"));
  it("personne", () =>
    expect(clientLabel({ id: "x", first_name: "Ali", last_name: "Ben" }, "x")).toBe("Ali Ben"));
  it("client_id null → tiret", () => expect(clientLabel(undefined, null)).toBe("—"));
  it("client absent → id court", () => expect(clientLabel(undefined, "abcd1234efgh")).toBe("#abcd1234"));
});

describe("dayBucket", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("passé", () => expect(dayBucket("2026-06-14T09:00:00Z", now)).toBe("past"));
  it("aujourd'hui", () => expect(dayBucket("2026-06-15T20:00:00Z", now)).toBe("today"));
  it("à venir", () => expect(dayBucket("2026-06-20T09:00:00Z", now)).toBe("upcoming"));
  it("invalide → upcoming", () => expect(dayBucket("nope", now)).toBe("upcoming"));
});

describe("isUpcoming", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("futur", () => expect(isUpcoming("2026-06-15T13:00:00Z", now)).toBe(true));
  it("passé", () => expect(isUpcoming("2026-06-15T11:00:00Z", now)).toBe(false));
  it("invalide", () => expect(isUpcoming("nope", now)).toBe(false));
});

describe("constantes", () => {
  it("types", () => expect(AGENDA_TYPES).toContain("visit"));
  it("statuts", () => expect(AGENDA_STATUSES).toEqual(["scheduled", "done", "cancelled"]));
});
