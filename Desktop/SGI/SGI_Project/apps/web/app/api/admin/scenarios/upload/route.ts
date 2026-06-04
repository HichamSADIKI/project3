/**
 * /api/admin/scenarios/upload — proxy multipart vers /api/v1/scenarios/upload.
 *
 * Le helper `proxy()` force `Content-Type: application/json` → inutilisable pour
 * un upload multipart. On relaie ici le corps brut + le `Content-Type` (avec son
 * boundary), en injectant le Bearer depuis le cookie de session httpOnly.
 */
import { NextResponse } from "next/server";

import { BACKEND_URL, getSessionToken } from "@/lib/api-proxy";

export async function POST(req: Request): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = await req.arrayBuffer();
  const upstream = await fetch(`${BACKEND_URL}/api/v1/scenarios/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": req.headers.get("content-type") ?? "application/octet-stream",
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
