/**
 * GET /api/admin/pending-users — proxy vers le backend FastAPI.
 * Relaie vers /api/v1/auth/pending-users en propageant `role_filter`.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "auth/pending-users", forwardQuery: true });
}
