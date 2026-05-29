/**
 * GET /api/admin/fournisseurs — proxy vers le backend FastAPI.
 *
 * Lit le cookie sgi-session, ajoute Bearer Authorization, relaie vers
 * /api/v1/auth/pending-fournisseurs : liste des fournisseurs en attente de
 * validation, enrichis de leur profil prestataire (catégorie, URL signée de
 * la licence commerciale, champs extraits par OCR).
 *
 * Utilisé par l'écran de validation fournisseur du back-office (apps/web).
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

export async function GET(): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const upstream = await fetch(`${BACKEND_URL}/api/v1/auth/pending-fournisseurs`, {
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
