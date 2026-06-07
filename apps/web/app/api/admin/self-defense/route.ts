/**
 * /api/admin/self-defense — proxy vers /api/v1/self-defense/event (authentifié).
 * POST : trace un événement du panneau Self-Defense (action + mode) dans l'audit.
 * Le code de validation n'est jamais envoyé au backend.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "self-defense/event" });
}
