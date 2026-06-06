/**
 * /api/admin/properties/import — import CSV en masse de biens (géolocalisés).
 * Relaie le multipart vers POST /api/v1/properties/import.csv.
 */
import { NextResponse } from "next/server";

import { proxyMultipart } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxyMultipart(req, { path: "properties/import.csv", method: "POST" });
}
