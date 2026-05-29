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

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request): Promise<NextResponse> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  // Marge de 1 MB pour les champs texte + overhead multipart.
  if (contentLength > 0 && contentLength > MAX_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "license_too_large" }, { status: 413 });
  }

  // Relai tel quel : Content-Type multipart (boundary inclus), body en stream.
  // `duplex: "half"` est exigé par undici pour un body ReadableStream.
  const upstream = await fetch(
    `${BACKEND_URL}/api/v1/auth/register/fournisseur-profile`,
    {
      method: "POST",
      headers: {
        "Content-Type": req.headers.get("content-type") ?? "multipart/form-data",
      },
      body: req.body,
      cache: "no-store",
      duplex: "half",
    } as RequestInit & { duplex: "half" },
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
