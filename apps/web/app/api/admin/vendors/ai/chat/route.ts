/** /api/admin/vendors/ai/chat — proxy POST → /api/v1/vendors/ai/chat. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "vendors/ai/chat" });
}
