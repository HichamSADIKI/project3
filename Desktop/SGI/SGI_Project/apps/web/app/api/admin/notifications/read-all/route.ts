/** /api/admin/notifications/read-all — proxy POST (tout marquer comme lu). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "notifications/read-all", method: "POST" });
}
