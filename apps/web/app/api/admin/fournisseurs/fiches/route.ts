/**
 * GET /api/admin/fournisseurs/fiches — proxy vers le backend FastAPI.
 *
 * Lit le cookie sgi-session, ajoute Bearer Authorization, relaie vers
 * /api/v1/vendors (catégorie « fournisseurs ») : liste paginée des fiches
 * fournisseurs (prestataires externes / party-role vendor).
 *
 * Query params relayés : vendor_type, is_active, page, limit.
 * Utilisé par l'écran « Fiches fournisseurs » du back-office (apps/web).
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const qs = req.nextUrl.searchParams.toString();
  const upstream = await fetch(
    `${BACKEND_URL}/api/v1/vendors/${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
