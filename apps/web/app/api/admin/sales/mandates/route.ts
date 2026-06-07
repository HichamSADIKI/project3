/**
 * /api/admin/sales/mandates — proxy vers /api/v1/sales/mandates (module Vente).
 * GET  : liste paginée (propage status, page, limit).
 * POST : création d'un mandat (seller_client_id, mandate_type, commission_rate…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sales/mandates", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sales/mandates" });
}
