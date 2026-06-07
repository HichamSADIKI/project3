/** /api/admin/finance/reports/pnl — proxy GET vers /finance/reports/pnl (P&L). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/reports/pnl", method: "GET", forwardQuery: true });
}
