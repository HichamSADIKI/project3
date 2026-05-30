/**
 * /api/client/transcribe — proxy multipart authentifié vers /api/v1/client/needs/transcribe
 *
 * Le proxy générique /api/proxy/[...path] sérialise le body en JSON, ce qui
 * casse les uploads. Cette route dédiée relaie le FormData (audio + locale)
 * vers FastAPI en préservant le multipart. Limite : 5 MB (aligné Whisper).
 */
import { NextResponse } from "next/server";

import { multipartProxy } from "@/lib/api-multipart";

const MAX_BYTES = 5 * 1024 * 1024;

export function POST(req: Request): Promise<NextResponse> {
  return multipartProxy(req, {
    path: "/api/v1/client/needs/transcribe",
    maxBytes: MAX_BYTES,
    oversizeError: "audio_too_large",
  });
}
