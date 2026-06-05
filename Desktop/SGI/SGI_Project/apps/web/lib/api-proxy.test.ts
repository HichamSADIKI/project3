import { describe, expect, it, vi } from "vitest";

// api-proxy.ts importe next/headers et next/server au niveau module ; on les
// neutralise (les fonctions testées n'en dépendent pas).
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/server", () => ({ NextResponse: { json: () => ({}) } }));

const { backendUrl } = await import("./api-proxy");

describe("backendUrl", () => {
  it("builds /api/v1/{path} on the backend base", () => {
    expect(backendUrl("clients/")).toBe("http://api:8000/api/v1/clients/");
  });

  it("strips leading slashes from the path", () => {
    expect(backendUrl("/auth/pending-users")).toBe(
      "http://api:8000/api/v1/auth/pending-users",
    );
  });

  it("forwards query params from the incoming request", () => {
    const req = new Request("http://web/api/admin/clients?type=company&q=acme&page=2");
    const url = new URL(backendUrl("clients/", req));
    expect(url.pathname).toBe("/api/v1/clients/");
    expect(url.searchParams.get("type")).toBe("company");
    expect(url.searchParams.get("q")).toBe("acme");
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("adds no query string when no request is given", () => {
    expect(backendUrl("crm/leads")).toBe("http://api:8000/api/v1/crm/leads");
  });
});

describe("proxyMultipart — garde 401", () => {
  it("ne relaie pas et renvoie tôt sans cookie de session", async () => {
    // Le mock de tête renvoie cookies.get() → undefined : pas de token.
    const { proxyMultipart } = await import("./api-proxy");
    const spy = vi.fn();
    global.fetch = spy as unknown as typeof fetch;
    const req = new Request("http://web/up", { method: "POST", body: new FormData() });
    await proxyMultipart(req, { path: "golden-visa/1/documents/passport" });
    expect(spy).not.toHaveBeenCalled(); // garde 401 → aucun appel upstream
  });
});

describe("proxyMultipart — relai authentifié", () => {
  it("relaie le FormData vers l'upstream avec le Bearer, sans Content-Type forcé", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      cookies: async () => ({ get: () => ({ value: "tok123" }) }),
    }));
    class FakeResp {
      body: unknown;
      status?: number;
      constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status;
      }
      static json(b: unknown, i?: { status?: number }): FakeResp {
        return new FakeResp(JSON.stringify(b), i);
      }
    }
    vi.doMock("next/server", () => ({ NextResponse: FakeResp }));
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const mod = await import("./api-proxy");
    const fd = new FormData();
    fd.append("file", new Blob(["x"], { type: "application/pdf" }), "p.pdf");
    const req = new Request("http://web/up", { method: "POST", body: fd });
    await mod.proxyMultipart(req, { path: "golden-visa/1/documents/passport" });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api:8000/api/v1/golden-visa/1/documents/passport");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer tok123" });
    expect(init.body).toBeInstanceOf(FormData);

    vi.doUnmock("next/headers");
    vi.doUnmock("next/server");
    vi.resetModules();
  });
});
