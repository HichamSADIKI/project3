/**
 * POST /api/auth/register/{client|fournisseur} — proxy vers le backend.
 * Le compte est créé en statut "pending" — validation admin requise.
 */
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ kind: string }> },
): Promise<NextResponse> {
  const { kind } = await ctx.params;
  if (kind !== "client" && kind !== "fournisseur") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const upstream = await fetch(`${BACKEND_URL}/api/v1/auth/register/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await upstream.json().catch(() => ({}))) as {
    detail?: string;
    [k: string]: unknown;
  };

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data.detail ?? "registration_failed" },
      { status: upstream.status },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
