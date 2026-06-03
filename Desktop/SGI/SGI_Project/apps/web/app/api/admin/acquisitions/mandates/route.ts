/**
 * /api/admin/acquisitions/mandates — proxy vers /api/v1/acquisitions/mandates.
 * GET  : liste paginée des mandats d'achat (propage status, page, limit).
 * POST : création d'un mandat (buyer_client_id, budget_min/max, property_type…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "acquisitions/mandates", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "acquisitions/mandates" });
}
