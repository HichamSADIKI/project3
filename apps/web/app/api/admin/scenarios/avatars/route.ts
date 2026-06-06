/** /api/admin/scenarios/avatars — proxy GET vers /api/v1/scenarios/avatars. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "scenarios/avatars" });
}
