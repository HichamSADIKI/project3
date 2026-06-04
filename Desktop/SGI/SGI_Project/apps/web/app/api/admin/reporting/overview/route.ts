/** /api/admin/reporting/overview — proxy GET vers /api/v1/reporting/overview. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "reporting/overview", method: "GET" });
}
