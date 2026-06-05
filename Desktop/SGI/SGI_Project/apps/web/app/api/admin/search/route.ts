/**
 * /api/admin/search — recherche globale back-office (biens·clients·contrats).
 * Relaie vers /api/v1/search (Meilisearch si peuplé, repli DB ILIKE).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "search", method: "GET", forwardQuery: true });
}
