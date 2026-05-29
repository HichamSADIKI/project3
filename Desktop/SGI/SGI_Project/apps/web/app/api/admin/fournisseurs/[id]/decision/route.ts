/**
 * POST /api/admin/fournisseurs/{id}/decision — proxy vers le backend FastAPI.
 *
 * Approuve/rejette un fournisseur en attente. Relaie vers
 * /api/v1/auth/pending-users/{id}/decision — le backend bascule le compte
 * (active/rejected) ET, en cascade, le profil prestataire lié
 * (verification_status verified/rejected). Corps : { approve, reason? }.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.text();

  const upstream = await fetch(
    `${BACKEND_URL}/api/v1/auth/pending-users/${id}/decision`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    },
  );

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
