/** /api/admin/platform/remediation-rules — règles d'auto-remédiation (GET liste, POST création). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, {
    path: "admin/platform/remediation-rules",
    method: "GET",
  });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, {
    path: "admin/platform/remediation-rules",
    method: "POST",
  });
}
