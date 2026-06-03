/**
 * /api/admin/leasing/applications — proxy vers /api/v1/leasing/applications (candidatures locataires).
 * GET  : liste paginée (propage listing_id, status, page, limit).
 * POST : création d'une candidature (listing_id, applicant_client_id, offered_rent?…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "leasing/applications", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "leasing/applications" });
}
