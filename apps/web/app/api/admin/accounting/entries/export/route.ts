/**
 * /api/admin/accounting/entries/export — proxy CSV (téléchargement du grand-livre).
 * Relaie le CSV upstream avec Content-Disposition (le proxy générique force du JSON).
 */
import { backendUrl, getSessionToken } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const upstream = await fetch(backendUrl("accounting/entries/export", req), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="grand-livre.csv"',
    },
  });
}
