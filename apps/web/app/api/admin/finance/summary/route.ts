/** /api/admin/finance/summary — proxy GET vers /api/v1/finance/summary (KPIs). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/summary", method: "GET" });
}
