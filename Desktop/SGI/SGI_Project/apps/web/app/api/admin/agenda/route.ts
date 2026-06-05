/**
 * /api/admin/agenda — proxy vers /api/v1/agenda.
 * GET : liste filtrable (event_type/status/date_from/date_to/page/limit).
 * POST : création d'un événement d'agenda.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "agenda", method: "GET", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "agenda", method: "POST" });
}
