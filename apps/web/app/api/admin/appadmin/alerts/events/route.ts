/** /api/admin/appadmin/alerts/events — alertes déclenchées (GET liste). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, {
    path: "admin/alerts/events",
    method: "GET",
    forwardQuery: true,
  });
}
