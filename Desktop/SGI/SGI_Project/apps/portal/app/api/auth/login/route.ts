/**
 * POST /api/auth/login — proxy vers le backend FastAPI.
 * Set un cookie httpOnly `sgi-session` avec le JWT en cas de succès.
 *
 * Accepte `company_slug` optionnel — requis pour les fournisseurs (vérifié backend).
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEFAULT_HOME_BY_ROLE, type UserRole } from "@sgi/shared-types";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface JwtPayloadLite {
  role?: UserRole;
  status?: string;
  sub?: string;
  exp?: number;
  language?: string;
}

function decodeJwtPayload(token: string): JwtPayloadLite | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(json) as JwtPayloadLite;
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: { email?: string; password?: string; company_slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  const upstreamPayload: Record<string, string> = {
    email: body.email,
    password: body.password,
  };
  if (body.company_slug) upstreamPayload.company_slug = body.company_slug;

  const upstream = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(upstreamPayload),
  });

  if (!upstream.ok) {
    // Relaie le code d'erreur du backend pour que l'UI affiche un message ciblé
    let detail = "invalid_credentials";
    try {
      const errBody = (await upstream.json()) as { detail?: string };
      if (typeof errBody.detail === "string") detail = errBody.detail;
    } catch {
      /* leave default */
    }
    const status =
      detail === "company_required" || detail === "company_mismatch"
        ? 422
        : upstream.status === 401
          ? 401
          : 502;
    return NextResponse.json({ error: detail }, { status });
  }

  const data = (await upstream.json()) as TokenResponse;
  const payload = decodeJwtPayload(data.access_token);
  const role = payload?.role ?? "client";

  // Refuse les rôles internes sur le portal public
  if (role === "admin" || role === "manager" || role === "agent") {
    return NextResponse.json(
      { error: "use_backoffice_portal" },
      { status: 403 },
    );
  }

  if (payload?.status && payload.status !== "active") {
    return NextResponse.json(
      { error: "account_not_active", status: payload.status },
      { status: 403 },
    );
  }

  const jar = await cookies();
  jar.set("sgi-session", data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: data.expires_in,
    path: "/",
  });

  const language =
    payload?.language && /^(ar|en|fr)$/.test(payload.language)
      ? payload.language
      : undefined;

  return NextResponse.json({
    role,
    redirect: DEFAULT_HOME_BY_ROLE[role],
    language,
  });
}
