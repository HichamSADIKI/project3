/** /api/admin/platform/network — proxy GET (métriques réseau instantanées Prometheus). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/network", method: "GET" });
}
