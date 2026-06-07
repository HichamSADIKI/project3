/** /api/admin/platform/alerts — proxy GET (alertes infra actives remontées par Prometheus). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/alerts", method: "GET" });
}
