/**
 * GET /api/admin/pending-users — proxy vers le backend FastAPI.
 * Lit le cookie sgi-session, ajoute Bearer Authorization, relaie l'appel.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

export async function GET(req: Request): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const roleFilter = url.searchParams.get("role_filter");
  const qs = roleFilter ? `?role_filter=${roleFilter}` : "";

  const upstream = await fetch(`${BACKEND_URL}/api/v1/auth/pending-users${qs}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
