/** /api/admin/platform/actions — historique des actions de contrôle (GET). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, {
    path: "admin/platform/actions",
    method: "GET",
    forwardQuery: true,
  });
}
