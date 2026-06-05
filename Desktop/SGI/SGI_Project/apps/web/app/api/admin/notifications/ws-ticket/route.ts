/**
 * /api/admin/notifications/ws-ticket — délivre un jeton WS court (60 s) pour
 * ouvrir le flux temps réel depuis le navigateur sans exposer le JWT de session.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "notifications/ws-ticket", method: "GET" });
}
