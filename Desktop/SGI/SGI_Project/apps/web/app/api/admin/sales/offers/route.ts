/**
 * /api/admin/sales/offers — proxy vers /api/v1/sales/offers (module Vente).
 * GET  : liste paginée (propage listing_id, status, page, limit).
 * POST : création d'une offre (listing_id, buyer_client_id, amount).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sales/offers", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sales/offers" });
}
