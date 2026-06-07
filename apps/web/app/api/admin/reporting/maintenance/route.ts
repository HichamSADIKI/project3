/** /api/admin/reporting/maintenance — proxy GET vers /api/v1/reporting/maintenance. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "reporting/maintenance", method: "GET" });
}
