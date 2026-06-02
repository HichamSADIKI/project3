/**
 * /api/admin/inbox/conversations — proxy vers /api/v1/inbox/conversations.
 * GET : liste paginée des fils omnicanaux (propage channel, status,
 * assigned_agent_id, page, limit…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "inbox/conversations", forwardQuery: true });
}
