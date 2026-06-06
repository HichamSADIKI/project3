/**
 * GET /api/admin/maintenance/tickets — proxy vers le backend FastAPI.
 * Relaie vers /api/v1/maintenance/tickets en propageant les query params.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "maintenance/tickets", forwardQuery: true });
}
