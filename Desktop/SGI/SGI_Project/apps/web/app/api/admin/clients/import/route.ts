/**
 * /api/admin/clients/import — import CSV en masse de clients.
 * Relaie le multipart vers POST /api/v1/clients/import.csv.
 */
import { NextResponse } from "next/server";

import { proxyMultipart } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxyMultipart(req, { path: "clients/import.csv", method: "POST" });
}
