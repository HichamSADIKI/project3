/**
 * /api/client/transcribe — proxy multipart authentifié vers /api/v1/client/needs/transcribe
 *
 * Le proxy générique /api/proxy/[...path] sérialise le body en JSON, ce qui
 * casse les uploads. Cette route dédiée relaie le FormData (audio + locale)
 * vers FastAPI en préservant le multipart.
 *
 * Limite : 5 MB d'audio (aligné avec le backend Whisper).
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 0 && contentLength > MAX_BYTES) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 413 });
  }

  // On relaie tel quel : Content-Type multipart/form-data avec boundary,
  // body en stream pour préserver l'encodage.
  const upstream = await fetch(`${BACKEND_URL}/api/v1/client/needs/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // Préserve l'en-tête multipart d'origine (boundary inclus)
      "Content-Type": req.headers.get("content-type") ?? "multipart/form-data",
    },
    // @ts-expect-error — Node 18+ fetch accepte ReadableStream comme body
    body: req.body,
    duplex: "half",
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
