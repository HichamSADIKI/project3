/**
 * /api/admin/social/posts — proxy vers /api/v1/social/posts.
 * GET  : posts sociaux du tenant (filtres listing_type / listing_id).
 * POST : publier une annonce sur un canal social.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "social/posts", forwardQuery: true });
}

export async function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "social/posts", method: "POST" });
}
