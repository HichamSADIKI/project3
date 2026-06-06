/** /api/admin/comms/conversations — proxy vers /api/v1/comms/conversations. */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "comms/conversations", forwardQuery: true });
}
