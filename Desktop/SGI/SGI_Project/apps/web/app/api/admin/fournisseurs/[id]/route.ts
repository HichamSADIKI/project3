/**
 * PATCH /api/admin/fournisseurs/{id} — proxy vers le backend FastAPI.
 *
 * Met à jour la fiche fournisseur (prestataire). Relaie vers
 * PATCH /api/v1/vendors/{party_id}. Utilisé notamment pour activer une ou
 * plusieurs catégories (`categories`) et le statut actif depuis le back-office.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

export async function PATCH(
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

  const upstream = await fetch(`${BACKEND_URL}/api/v1/vendors/${id}`, {
    method: "PATCH",
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
