/**
 * /api/admin/tickets — proxy vers /api/v1/tickets (module Ticketing SLA).
 * GET  : liste paginée (propage status, priority, assigned_agent_id, page, limit).
 * POST : création d'un ticket (subject, description, category, priority…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "tickets", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "tickets" });
}
