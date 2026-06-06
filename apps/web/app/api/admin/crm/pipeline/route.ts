/**
 * /api/admin/crm/pipeline — proxy GET vers /api/v1/crm/pipeline
 * (compte de leads par statut du pipeline, enveloppe {success,data:{status:count}}).
 * Consommé par l'écran « Process Immobilier » pour agréger les leads qualifiés.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "crm/pipeline", forwardQuery: true });
}
