/**
 * /api/admin/leasing/listings — proxy vers /api/v1/leasing/listings (annonces de location).
 * GET  : liste paginée (propage status, page, limit).
 * POST : création d'une annonce (unit_id?, title_*, monthly_rent, annual_rent?…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "leasing/listings", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "leasing/listings" });
}
