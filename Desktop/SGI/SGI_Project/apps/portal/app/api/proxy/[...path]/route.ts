/**
 * /api/proxy/[...path] — proxy authentifié vers le backend FastAPI.
 *
 * Lit le cookie sgi-session, ajoute Authorization: Bearer <token>, et relaie
 * vers ${BACKEND_API_URL}/api/v1/<path>. Permet aux Client Components du
 * portal d'appeler le backend sans exposer le JWT au navigateur.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";
const ALLOWED_METHODS = ["GET", "POST", "PATCH", "DELETE"] as const;
type AllowedMethod = (typeof ALLOWED_METHODS)[number];

// Préfixes autorisés sur le portal public (whitelist stricte).
const ALLOWED_PREFIXES = ["client/", "fournisseur/", "owner/", "payments/"];

async function relay(req: Request, path: string[], method: AllowedMethod) {
  const subpath = path.join("/");
  if (!ALLOWED_PREFIXES.some((p) => subpath.startsWith(p))) {
    return NextResponse.json({ error: "forbidden_path" }, { status: 403 });
  }

  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body =
    method === "GET" || method === "DELETE" ? undefined : await req.text();

  const upstream = await fetch(`${BACKEND_URL}/api/v1/${subpath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
    cache: "no-store",
  });

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return relay(req, (await ctx.params).path, "GET");
}
export async function POST(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return relay(req, (await ctx.params).path, "POST");
}
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return relay(req, (await ctx.params).path, "PATCH");
}
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return relay(req, (await ctx.params).path, "DELETE");
}
