/**
 * /api/admin/properties/search/radius — recherche géospatiale par rayon
 * (PostGIS ST_DWithin). Relaie vers POST /api/v1/properties/search/radius.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "properties/search/radius", method: "POST" });
}
