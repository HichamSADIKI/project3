/**
 * /api/admin/honeytokens — proxy vers /api/v1/admin/honeytokens (authentifié).
 * GET  : liste des leurres de la société (avec token-secret, admin/manager).
 * POST : crée un leurre (kind + label ; token signé généré côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/honeytokens", forwardQuery: true });
}

export async function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/honeytokens" });
}
