/** /api/admin/platform/backups — liste des runs de sauvegarde (GET). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/backups", method: "GET", forwardQuery: true });
}
