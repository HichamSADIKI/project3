/** /api/admin/telephony/agents/me/status — proxy POST (sélecteur de statut agent). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "telephony/agents/me/status" });
}
