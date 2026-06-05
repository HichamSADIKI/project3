/** /api/admin/accounting/trial-balance — proxy GET balance générale. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "accounting/trial-balance", method: "GET" });
}
