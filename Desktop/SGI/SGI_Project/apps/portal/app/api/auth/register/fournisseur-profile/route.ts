/**
 * POST /api/auth/register/fournisseur-profile — proxy multipart vers le backend.
 *
 * Inscription d'un fournisseur prestataire (compte + profil + licence). Le proxy
 * générique /api/proxy sérialise en JSON, ce qui casse l'upload de fichier ;
 * cette route dédiée relaie le FormData (champs + licence commerciale) à FastAPI
 * en préservant le multipart. Endpoint public — aucune session requise.
 *
 * Limite : 8 MB (alignée avec le backend).
 */
import { NextResponse } from "next/server";

import { forwardMultipart, guardSize } from "@/lib/api-multipart";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request): Promise<NextResponse> {
  // Marge de 1 MB pour les champs texte + overhead multipart.
  const tooBig = guardSize(req, MAX_BYTES, "license_too_large", 1024 * 1024);
  if (tooBig) return tooBig;

  // Endpoint public : pas de Bearer.
  const upstream = await forwardMultipart(
    req,
    "/api/v1/auth/register/fournisseur-profile",
  );

  const data = (await upstream.json().catch(() => ({}))) as {
    detail?: string;
    [k: string]: unknown;
  };

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data.detail ?? "registration_failed" },
      { status: upstream.status },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
