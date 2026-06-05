/** /api/admin/finance/reports/cashflow — proxy GET (prévision de trésorerie). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/reports/cashflow", method: "GET" });
}
