/** /api/admin/reporting/rentals — proxy GET vers /api/v1/reporting/rentals (forward expiring_days). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "reporting/rentals", method: "GET", forwardQuery: true });
}
