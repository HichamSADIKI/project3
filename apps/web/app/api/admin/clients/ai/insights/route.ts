/** /api/admin/clients/ai/insights — proxy POST → /api/v1/clients/ai/insights. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "clients/ai/insights", forwardQuery: true });
}
