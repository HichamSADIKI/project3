import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient, postFormData } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiClient", () => {
  it("returns the parsed JSON on success and sets Content-Type", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    global.fetch = spy as unknown as typeof fetch;

    const data = await apiClient<{ ok: number }>("/api/proxy/client/me");
    expect(data).toEqual({ ok: 1 });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("serialises the `json` option into the body", async () => {
    const spy = vi.fn(async () => new Response(null, { status: 204 }));
    global.fetch = spy as unknown as typeof fetch;

    await apiClient("/api/proxy/client/needs", { method: "POST", json: { a: 1 } });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("returns undefined on 204", async () => {
    global.fetch = vi.fn(
      async () => new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    expect(await apiClient("/api/proxy/x")).toBeUndefined();
  });

  it("throws ApiError with status + detail (prefers `error`)", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: "forbidden", detail: "x" }), { status: 403 }),
    ) as unknown as typeof fetch;

    await expect(apiClient("/api/proxy/x")).rejects.toBeInstanceOf(ApiError);
    try {
      await apiClient("/api/proxy/x");
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(403);
      expect(err.detail).toBe("forbidden");
    }
  });
});

describe("postFormData", () => {
  it("POSTs the FormData without forcing Content-Type (boundary auto)", async () => {
    const spy = vi.fn(async () => new Response(null, { status: 201 }));
    global.fetch = spy as unknown as typeof fetch;

    const fd = new FormData();
    fd.append("doc_type", "trade_licence");
    const res = await postFormData("/api/fournisseur/documents", fd);

    expect(res.status).toBe(201);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/fournisseur/documents");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(fd);
    // Pas de Content-Type fixé manuellement (le navigateur ajoute le boundary).
    expect(init.headers).toBeUndefined();
  });
});
