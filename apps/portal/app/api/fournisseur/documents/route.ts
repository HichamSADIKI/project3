/**
 * POST /api/fournisseur/documents — proxy multipart authentifié.
 *
 * Relaie l'upload d'un document KYC (FormData : doc_type, expiry_date?, file)
 * vers /api/v1/fournisseur/documents en préservant le multipart (le proxy
 * générique sérialise en JSON et casserait le fichier). Limite : 8 MB.
 */
import { NextResponse } from "next/server";

import { multipartProxy } from "@/lib/api-multipart";

const MAX_BYTES = 8 * 1024 * 1024;

export function POST(req: Request): Promise<NextResponse> {
  return multipartProxy(req, {
    path: "/api/v1/fournisseur/documents",
    maxBytes: MAX_BYTES,
    oversizeError: "file_too_large",
    oversizeMargin: 1024 * 1024,
  });
}
