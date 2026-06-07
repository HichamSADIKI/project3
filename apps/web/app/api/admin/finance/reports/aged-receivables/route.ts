/** /api/admin/finance/reports/aged-receivables — proxy GET (balance âgée). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/reports/aged-receivables", method: "GET" });
}
