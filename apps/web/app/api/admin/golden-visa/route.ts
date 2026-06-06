/**
 * /api/admin/golden-visa — proxy vers /api/v1/golden-visa/.
 * GET : liste paginée filtrable (status/client_id/page/limit) — query relayée.
 * POST : création d'une demande Golden Visa.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "golden-visa/", method: "GET", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "golden-visa/", method: "POST" });
}
