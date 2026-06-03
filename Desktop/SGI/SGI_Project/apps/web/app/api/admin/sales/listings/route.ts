/**
 * /api/admin/sales/listings — proxy vers /api/v1/sales/listings (module Vente).
 * GET  : liste paginée (propage status, mandate_id, page, limit).
 * POST : création d'une annonce (mandate_id, list_price, title_fr…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sales/listings", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sales/listings" });
}
