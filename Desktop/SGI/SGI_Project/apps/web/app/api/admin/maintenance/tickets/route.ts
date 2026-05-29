/**
 * GET /api/admin/maintenance/tickets — proxy vers le backend FastAPI.
 * Relaie vers /api/v1/maintenance/tickets en propageant les query params.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

export async function GET(req: Request): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const incoming = new URL(req.url);
  const upstream = new URL(`${BACKEND_URL}/api/v1/maintenance/tickets`);
  for (const [k, v] of incoming.searchParams.entries()) upstream.searchParams.set(k, v);

  const res = await fetch(upstream.toString(), {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
