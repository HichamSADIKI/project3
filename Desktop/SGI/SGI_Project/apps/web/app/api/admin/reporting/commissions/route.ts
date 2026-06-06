/** /api/admin/reporting/commissions — proxy GET (rapprochement commissions agents). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "reporting/commissions", method: "GET" });
}
