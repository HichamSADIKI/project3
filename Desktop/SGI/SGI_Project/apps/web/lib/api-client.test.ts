import { afterEach, describe, expect, it, vi } from "vitest";

import { extractError, getJson, postJson } from "./api-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractError", () => {
  it("prefers `detail` then `error` then fallback", async () => {
    expect(
      await extractError(new Response(JSON.stringify({ detail: "boom" }), { status: 400 })),
    ).toBe("boom");
    expect(
      await extractError(new Response(JSON.stringify({ error: "nope" }), { status: 400 })),
    ).toBe("nope");
  });

  it("falls back when body is not JSON", async () => {
    expect(await extractError(new Response("<<html>>", { status: 500 }))).toBe("load_failed");
  });

  it("uses a custom fallback", async () => {
    expect(await extractError(new Response("x", { status: 500 }), "oops")).toBe("oops");
  });
});

describe("getJson", () => {
  it("returns the parsed body on 200", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify([{ id: 1 }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const data = await getJson<{ id: number }[]>("/api/admin/x");
    expect(data).toEqual([{ id: 1 }]);
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/x", { cache: "no-store" });
  });

  it("throws Error(detail) when not ok", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ detail: "forbidden" }), { status: 403 }),
    ) as unknown as typeof fetch;
    await expect(getJson("/api/admin/x")).rejects.toThrow("forbidden");
  });
});

describe("postJson", () => {
  it("POSTs JSON with the right headers and returns the raw Response", async () => {
    const spy = vi.fn(async () => new Response(null, { status: 201 }));
    global.fetch = spy as unknown as typeof fetch;
    const res = await postJson("/api/admin/clients", { type: "individual" });
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledWith("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "individual" }),
    });
  });
});
