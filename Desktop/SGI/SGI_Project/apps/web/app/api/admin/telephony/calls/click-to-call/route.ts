/** /api/admin/telephony/calls/click-to-call — proxy POST (originate). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "telephony/calls/click-to-call" });
}
