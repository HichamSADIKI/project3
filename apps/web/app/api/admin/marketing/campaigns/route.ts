/**
 * /api/admin/marketing/campaigns — proxy vers /api/v1/marketing/campaigns.
 * GET  : liste paginée (propage status, channel, page, limit).
 * POST : création d'une campagne (name, channel, budget_aed?, starts_on?, ends_on?…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "marketing/campaigns", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "marketing/campaigns" });
}
