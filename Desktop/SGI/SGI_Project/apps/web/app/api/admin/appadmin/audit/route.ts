/**
 * /api/admin/audit — proxy GET vers /api/v1/admin/audit.
 *
 * Journal d'audit du tenant (Loi 1 : scopé company_id côté backend via le GUC).
 * `forwardQuery` recopie les filtres (action / actor / from / to / q / page /
 * limit) vers l'upstream. Réponse JSON {success, data, meta} relayée telle quelle.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, {
    path: "admin/audit",
    method: "GET",
    forwardQuery: true,
  });
}
