/**
 * /api/admin/telephony/calls — proxy vers /api/v1/telephony/calls.
 * GET : journal d'appels paginé (propage direction, status, agent_user_id, page, limit…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "telephony/calls", forwardQuery: true });
}
