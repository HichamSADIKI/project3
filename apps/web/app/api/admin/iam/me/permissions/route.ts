/** /api/admin/iam/me/permissions — permissions effectives de l'utilisateur courant. */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "iam/me/permissions" });
}
