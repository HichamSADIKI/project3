/**
 * /api/admin/copilot/assist — proxy vers /api/v1/copilot/assist (module AI Copilot).
 * POST : body { context_type:"inbox"|"ticket", context_id, locale? } → suggestion IA.
 * Propage le query param `?push=true` (mode asynchrone WS) tel quel ; le MVP
 * front utilise le mode synchrone (sans push).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "copilot/assist", forwardQuery: true });
}
