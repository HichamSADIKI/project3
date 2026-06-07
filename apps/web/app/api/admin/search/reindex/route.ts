/**
 * /api/admin/search/reindex — (ré)indexe la société courante dans Meilisearch.
 * Réservé admin/manager côté backend.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "search/reindex", method: "POST" });
}
