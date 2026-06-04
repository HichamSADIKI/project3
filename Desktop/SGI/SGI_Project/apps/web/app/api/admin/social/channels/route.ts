/**
 * /api/admin/social/channels — proxy GET vers /api/v1/social/channels.
 * Liste des canaux sociaux supportés.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "social/channels" });
}
