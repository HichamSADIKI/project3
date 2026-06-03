/**
 * /api/admin/sources/imports — proxy GET vers /api/v1/sources/imports
 * (journal de provenance / dédup / rejets, enveloppe {success,data,meta:{total}}).
 * forwardQuery relaie ?status= / ?source_type= / ?source_channel= / ?page= / ?limit=.
 * Consommé par l'écran « Process Immobilier » (phases Sources + Watcher).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "sources/imports", forwardQuery: true });
}
