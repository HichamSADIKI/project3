/** /api/admin/self-defense/verify — proxy → /api/v1/self-defense/verify (authentifié).
 * POST : valide le code armer/désarmer côté serveur (jamais le hash). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "self-defense/verify" });
}
