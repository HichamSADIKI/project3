/**
 * GET/POST /api/admin/clients — proxy vers le backend FastAPI.
 *
 * Lit le cookie sgi-session, ajoute Bearer Authorization, relaie l'appel
 * vers /api/v1/clients/ (GET avec query params `type`, `q`, `page`, `limit`,
 * POST avec corps ClientCreate).
 *
 * Utilisé par le back-office (apps/web) pour afficher et créer les clients
 * (individus / sociétés) — la même table que celle modifiée par les clients
 * depuis le portail (apps/portal /client/profile). C'est l'unique source de
 * vérité côté CRM.
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

  const incoming = new URL(req.url);
  const upstreamUrl = new URL(`${BACKEND_URL}/api/v1/clients/`);
  for (const [k, v] of incoming.searchParams.entries()) {
    upstreamUrl.searchParams.set(k, v);
  }

  const upstream = await fetch(upstreamUrl.toString(), {
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

export async function POST(req: Request): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.text();
  const upstream = await fetch(`${BACKEND_URL}/api/v1/clients/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
