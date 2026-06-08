/** /api/presence/heartbeat — proxy → /api/v1/presence/heartbeat (authentifié, tout user).
 * POST : signale la session + la page courante (présence live). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "presence/heartbeat" });
}
