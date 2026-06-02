/**
 * /api/admin/sales/transactions — proxy vers /api/v1/sales/transactions (Vente).
 * GET  : liste paginée (propage status, page, limit).
 * POST : création d'une transaction depuis une offre acceptée (offer_id, final_price?).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sales/transactions", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sales/transactions" });
}
