/** /api/admin/platform/backups/trigger — déclenche une sauvegarde (POST, dry-run par défaut). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/backups/trigger", method: "POST" });
}
