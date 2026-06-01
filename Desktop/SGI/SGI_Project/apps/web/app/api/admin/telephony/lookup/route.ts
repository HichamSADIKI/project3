/** /api/admin/telephony/lookup — proxy GET (screen pop : clients d'un numéro). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "telephony/lookup", forwardQuery: true });
}
