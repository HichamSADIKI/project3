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
