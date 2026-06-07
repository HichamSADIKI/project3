/** /api/admin/reporting/financial — proxy GET vers /api/v1/reporting/financial. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "reporting/financial", method: "GET" });
}
