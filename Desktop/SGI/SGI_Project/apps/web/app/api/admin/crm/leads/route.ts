/**
 * GET /api/admin/crm/leads — proxy vers le backend FastAPI.
 *
 * Lit le cookie sgi-session, ajoute Bearer Authorization, relaie vers
 * /api/v1/crm/leads en propageant les query params (`category`, `status`,
 * `page`, `limit`, `q`). Utilisé par le CRM par secteur du back-office pour
 * afficher les deals — notamment ceux soumis depuis le portail client,
 * filtrés par `category` (= secteur).
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
  const upstreamUrl = new URL(`${BACKEND_URL}/api/v1/crm/leads`);
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
