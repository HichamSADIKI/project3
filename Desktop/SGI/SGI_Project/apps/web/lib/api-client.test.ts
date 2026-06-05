import { afterEach, describe, expect, it, vi } from "vitest";

import { extractError, getJson, postJson, postForm } from "./api-client";

afterEach(() => {
  vi.restoreAllMocks();
  // Certains tests simulent un `window` (browser) — on nettoie pour ne pas
  // fuiter sur les tests env-node suivants.
  delete (globalThis as { window?: unknown }).window;
});

/** Simule un environnement browser minimal pour activer le refresh transparent. */
function fakeBrowser(pathname = "/x"): { href: string } {
  const location = { href: "", pathname, reload: () => {} };
  (globalThis as { window?: unknown }).window = { location };
  return location;
}

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

  it("throws `unauthenticated` on 401 (session expirée) without parsing the body", async () => {
    // Le middleware renvoie 401 JSON ; getJson ne doit jamais tenter de parser un
    // éventuel corps HTML (régression « Unexpected token '<' »). En env node,
    // handleUnauthenticated no-op (pas de window) — on vérifie juste le throw.
    global.fetch = vi.fn(
      async () => new Response("<!DOCTYPE html><html></html>", { status: 401 }),
    ) as unknown as typeof fetch;
    await expect(getJson("/api/admin/buildings")).rejects.toThrow("unauthenticated");
  });

  it("on 401, refreshes transparently then retries once and returns the data", async () => {
    fakeBrowser();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("x", { status: 401 })) // GET initial → access expiré
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 })) // refresh OK
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [1] }), { status: 200 })); // rejeu OK
    global.fetch = fetchMock as unknown as typeof fetch;

    const data = await getJson<{ data: number[] }>("/api/admin/x");
    expect(data).toEqual({ data: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(3); // GET → refresh → rejeu
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
  });

  it("on 401, redirects to login when the refresh also fails (no retry)", async () => {
    const location = fakeBrowser("/x");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("x", { status: 401 })) // GET initial
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "no_refresh_token" }), { status: 401 }),
      ); // refresh KO
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(getJson("/api/admin/x")).rejects.toThrow("unauthenticated");
    expect(location.href).toBe("/"); // bascule vers le login
    expect(fetchMock).toHaveBeenCalledTimes(2); // pas de rejeu après échec du refresh
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

  it("on 401, refreshes then replays the POST once and returns the retry response", async () => {
    fakeBrowser();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("x", { status: 401 })) // POST initial → access expiré
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 })) // refresh OK
      .mockResolvedValueOnce(new Response(null, { status: 201 })); // rejeu du POST → créé
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await postJson("/api/admin/clients", { type: "individual" });
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(3); // POST → refresh → rejeu
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
  });

  it("on 401, redirects to login when the refresh fails and returns the 401", async () => {
    const location = fakeBrowser("/x");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("x", { status: 401 })) // POST initial
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "no_refresh_token" }), { status: 401 })); // refresh KO
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await postJson("/api/admin/clients", { type: "individual" });
    expect(res.status).toBe(401);
    expect(location.href).toBe("/"); // bascule login
    expect(fetchMock).toHaveBeenCalledTimes(2); // pas de rejeu après échec du refresh
  });
});

describe("postForm", () => {
  it("POSTs FormData WITHOUT a Content-Type (le boundary est posé par fetch)", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }));
    global.fetch = spy as unknown as typeof fetch;
    const fd = new FormData();
    fd.append("file", new Blob(["x"], { type: "application/pdf" }), "p.pdf");
    const res = await postForm("/api/admin/golden-visa/1/documents/passport", fd);
    expect(res.status).toBe(201);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/admin/golden-visa/1/documents/passport");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(fd);
    expect(init.headers).toBeUndefined(); // pas de Content-Type forcé
  });

  it("on 401, refreshes then replays the upload once", async () => {
    fakeBrowser();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("x", { status: 401 })) // upload initial
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 })) // refresh OK
      .mockResolvedValueOnce(new Response(null, { status: 201 })); // rejeu OK
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await postForm("/api/admin/golden-visa/1/documents/dld", new FormData());
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
  });
});
