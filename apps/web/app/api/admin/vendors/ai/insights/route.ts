/** /api/admin/vendors/ai/insights — proxy POST → /api/v1/vendors/ai/insights. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "vendors/ai/insights", forwardQuery: true });
}
