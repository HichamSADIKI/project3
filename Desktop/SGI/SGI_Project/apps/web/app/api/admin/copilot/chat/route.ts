/**
 * /api/admin/copilot/chat — proxy vers /api/v1/copilot/chat (assistant in-app).
 * POST : body { messages:[{role,content}], locale?, screen? } → { reply, engine,
 * suggested_navigation } (mode synchrone : Gemini + repli heuristique).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "copilot/chat" });
}
