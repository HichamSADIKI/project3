/**
 * /api/admin/audit/export.csv — proxy de **téléchargement** CSV vers
 * /api/v1/admin/audit/export.csv.
 *
 * Le proxy générique force du JSON ; ici on relaie le flux CSV tel quel
 * (Content-Type + Content-Disposition) pour déclencher le téléchargement
 * navigateur. `backendUrl(path, req)` recopie les filtres (action / actor /
 * from / to / q) vers l'upstream. Loi 1 : scope company_id côté backend.
 */
import { NextResponse } from "next/server";

import { backendUrl, getSessionToken } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const upstream = await fetch(backendUrl("admin/audit/export.csv", req), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ??
        'attachment; filename="audit.csv"',
    },
  });
}
