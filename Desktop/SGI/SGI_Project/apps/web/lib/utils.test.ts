import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values (clsx)", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("resolves Tailwind conflicts (tailwind-merge keeps the last)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-start", "text-end")).toBe("text-end");
  });
});
