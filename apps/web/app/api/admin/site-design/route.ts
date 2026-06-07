/**
 * /api/admin/site-design — proxy vers /api/v1/site-design (authentifié).
 * GET : réglage courant du design du site public + style actif résolu.
 * PUT : enregistre mode / style / délai de rotation (rôles admin·manager).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "site-design" });
}

export async function PUT(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "site-design", method: "PUT" });
}
