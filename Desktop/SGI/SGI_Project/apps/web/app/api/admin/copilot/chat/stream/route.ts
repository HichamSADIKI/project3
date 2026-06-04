/**
 * /api/admin/copilot/chat/stream — proxy STREAMING vers /api/v1/copilot/chat/stream.
 * Relaie le flux SSE de l'assistant tel quel (effet « en train d'écrire »).
 * On ne peut pas utiliser le helper `proxy()` (il bufferise) : on renvoie
 * directement le `ReadableStream` upstream.
 */
import { backendUrl, getSessionToken } from "@/lib/api-proxy";

export async function POST(req: Request): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(backendUrl("copilot/chat/stream"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: await req.text(),
    cache: "no-store",
  });

  // Relaie le corps en streaming (SSE) sans le bufferiser.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
