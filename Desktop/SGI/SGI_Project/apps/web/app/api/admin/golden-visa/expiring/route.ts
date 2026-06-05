/**
 * /api/admin/golden-visa/expiring — proxy vers /api/v1/golden-visa/expiring.
 * GET : visas qui expirent sous `days` jours (défaut 90) — alertes J-90 / J-30.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "golden-visa/expiring", method: "GET", forwardQuery: true });
}
