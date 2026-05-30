/**
 * /api/admin/branches — proxy vers le backend FastAPI (/api/v1/branches).
 * GET : liste paginée (propage les query params : emirate, is_active, page…).
 * POST : création d'une succursale.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "branches", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "branches" });
}
