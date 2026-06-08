/** /api/admin/platform/security/overview — superviseur de sécurité global (GET). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/security/overview", method: "GET" });
}
