/**
 * POST /api/fournisseur/documents — proxy multipart authentifié.
 *
 * Relaie l'upload d'un document KYC (FormData : doc_type, expiry_date?, file)
 * vers /api/v1/fournisseur/documents en préservant le multipart (le proxy
 * générique sérialise en JSON et casserait le fichier). Lit le cookie
 * sgi-session et ajoute le Bearer. Limite : 8 MB.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 0 && contentLength > MAX_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const upstream = await fetch(`${BACKEND_URL}/api/v1/fournisseur/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": req.headers.get("content-type") ?? "multipart/form-data",
    },
    body: req.body,
    cache: "no-store",
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
