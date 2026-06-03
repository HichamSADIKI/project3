/**
 * /api/admin/marketing/kpis — proxy GET vers /api/v1/marketing/kpis
 * (totaux par statut + impressions/clics/leads/spend agrégés par tenant).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "marketing/kpis", forwardQuery: true });
}
