/** /api/admin/notifications/unread-count — proxy GET (badge cloche). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "notifications/unread-count", method: "GET" });
}
