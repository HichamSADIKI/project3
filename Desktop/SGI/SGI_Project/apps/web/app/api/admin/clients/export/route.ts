/**
 * /api/admin/clients/export — proxy de **téléchargement** vers
 * /api/v1/clients/export.csv. Contrairement au proxy générique (qui force le
 * Content-Type JSON), on relaie le flux CSV tel quel (Content-Type +
 * Content-Disposition) pour déclencher le téléchargement navigateur. Propage les
 * filtres `type` / `q`.
 */
import { NextResponse } from "next/server";

import { backendUrl, getSessionToken } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const upstream = await fetch(backendUrl("clients/export.csv", req), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ?? 'attachment; filename="clients.csv"',
    },
  });
}
