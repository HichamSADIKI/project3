/**
 * /api/admin/inspections — proxy vers /api/v1/inspections.
 * GET : liste paginée filtrable (unit_id/inspection_type/status/page/limit).
 * POST : création d'un état des lieux.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "inspections", method: "GET", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "inspections", method: "POST" });
}
