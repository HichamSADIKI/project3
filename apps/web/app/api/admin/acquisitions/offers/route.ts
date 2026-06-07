/**
 * /api/admin/acquisitions/offers — proxy vers /api/v1/acquisitions/offers.
 * GET  : liste paginée des offres d'achat (propage mandate_id, status, page, limit).
 * POST : création d'une offre (mandate_id, property_id, amount…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "acquisitions/offers", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "acquisitions/offers" });
}
