/** /api/admin/finance/reports/vat — proxy GET vers /finance/reports/vat (TVA UAE). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/reports/vat", method: "GET", forwardQuery: true });
}
