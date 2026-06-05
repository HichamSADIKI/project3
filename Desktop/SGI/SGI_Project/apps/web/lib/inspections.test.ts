import { describe, it, expect } from "vitest";

import { unitLabel, inspectionActions, isOpen, INSP_FLOW } from "./inspections";

describe("unitLabel", () => {
  it("n° d'unité", () => expect(unitLabel({ id: "x", unit_number: "A-1203" }, "x")).toBe("A-1203"));
  it("repli id court", () => expect(unitLabel(undefined, "abcd1234efgh")).toBe("#abcd1234"));
  it("unité sans numéro", () => expect(unitLabel({ id: "x" }, "abcd1234efgh")).toBe("#abcd1234"));
});

describe("inspectionActions", () => {
  it("draft → start", () => expect(inspectionActions("draft")).toEqual(["start"]));
  it("scheduled → start", () => expect(inspectionActions("scheduled")).toEqual(["start"]));
  it("in_progress → complete", () => expect(inspectionActions("in_progress")).toEqual(["complete"]));
  it("completed → sign", () => expect(inspectionActions("completed")).toEqual(["sign"]));
  it("signed → aucune", () => expect(inspectionActions("signed")).toEqual([]));
  it("cancelled → aucune", () => expect(inspectionActions("cancelled")).toEqual([]));
});

describe("isOpen", () => {
  it("in_progress ouvert", () => expect(isOpen("in_progress")).toBe(true));
  it("signed terminal", () => expect(isOpen("signed")).toBe(false));
  it("cancelled terminal", () => expect(isOpen("cancelled")).toBe(false));
});

describe("INSP_FLOW", () => {
  it("in_progress → completed possible", () => expect(INSP_FLOW.in_progress).toContain("completed"));
  it("signed terminal", () => expect(INSP_FLOW.signed).toEqual([]));
});
