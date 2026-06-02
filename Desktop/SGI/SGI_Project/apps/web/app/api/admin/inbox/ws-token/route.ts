import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/api-proxy";

/**
 * GET /api/admin/inbox/ws-token — renvoie le JWT de session (lu côté serveur
 * dans le cookie httpOnly `sgi-session`) pour ouvrir la WebSocket Inbox temps
 * réel, que JS ne peut pas lire directement. Le backend WS décode ce même JWT
 * et vérifie company_id / user_id (anti-spoof). ⚠️ Expose le JWT de session à
 * JS (même décision sécu que comms/ws-token et telephony/ws-token).
 */
export async function GET(): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "unauthenticated" } },
      { status: 401 },
    );
  }
  return NextResponse.json({ token });
}
