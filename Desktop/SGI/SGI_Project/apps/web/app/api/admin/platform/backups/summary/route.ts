/** /api/admin/platform/backups/summary — résumé par cible (GET). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/backups/summary", method: "GET" });
}
