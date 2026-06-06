/** /api/admin/platform/servers — proxy GET (état des services supervisés + live Prometheus). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/servers", method: "GET" });
}
