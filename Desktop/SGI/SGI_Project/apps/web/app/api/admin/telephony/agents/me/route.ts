/** /api/admin/telephony/agents/me — proxy GET (état de l'agent courant). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "telephony/agents/me" });
}
