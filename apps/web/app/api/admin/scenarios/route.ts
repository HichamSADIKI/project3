/**
 * /api/admin/scenarios — proxy vers /api/v1/scenarios.
 * GET  : scénarios vidéo du tenant (filtres listing_type / listing_id).
 * POST : créer un scénario (génération stub → vidéo prête).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "scenarios/", forwardQuery: true });
}

export async function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "scenarios/", method: "POST" });
}
