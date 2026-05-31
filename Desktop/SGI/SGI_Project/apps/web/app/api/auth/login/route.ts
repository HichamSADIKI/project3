/**
 * POST /api/auth/login — proxy d'authentification du back-office vers le backend FastAPI.
 *
 * Le front envoie { login, password } (login = email). On relaie vers
 * `${BACKEND_API_URL}/api/v1/auth/login`, on valide le rôle (back-office =
 * admin/manager/agent uniquement — les rôles publics client/fournisseur sont
 * redirigés vers le portail), puis on stocke le JWT backend dans le cookie
 * httpOnly `sgi-session`.
 *
 * Important : le JWT vient du backend (signé avec SECRET_KEY). Le middleware
 * Edge (middleware.ts) re-vérifie sa signature avec JWT_SECRET — les deux
 * secrets DOIVENT être identiques (cf. apps/web/.env.local & docker-compose).
 */
import { NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api-proxy";
import { setSessionCookies } from "@/lib/auth-cookies";

// ─── Rate limiter (in-memory) — max 5 tentatives par IP / 15 min ───────────────

const RATE_LIMIT_MAP = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = RATE_LIMIT_MAP.get(ip);

  if (!record || now > record.resetAt) {
    RATE_LIMIT_MAP.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
}

function resetRateLimit(ip: string): void {
  RATE_LIMIT_MAP.delete(ip);
}

// ─── JWT helpers (lecture du payload, sans vérification — la vérif est faite
//     par le middleware Edge et par le backend) ───────────────────────────────

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
}

interface JwtPayloadLite {
  role?: string;
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

const BACKOFFICE_ROLES = new Set(["admin", "manager", "agent"]);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Content-Type
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 415 });
  }

  // Rate limit
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter ?? 60) } },
    );
  }

  // Corps : le front envoie { login, password }
  let login: string, password: string, companySlug: string | undefined;
  try {
    const body = (await req.json()) as {
      login?: unknown;
      password?: unknown;
      company_slug?: unknown;
    };
    login = typeof body.login === "string" ? body.login.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
    companySlug = typeof body.company_slug === "string" ? body.company_slug : undefined;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!login || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }
  if (login.length > 100 || password.length > 128) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // Relai vers le backend (login = email)
  const upstreamPayload: Record<string, string> = { email: login, password };
  if (companySlug) upstreamPayload.company_slug = companySlug;

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamPayload),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    // Délai anti-brute-force, puis relai du code d'erreur backend
    await new Promise((r) => setTimeout(r, 400));
    let detail = "invalid_credentials";
    try {
      const errBody = (await upstream.json()) as { detail?: string };
      if (typeof errBody.detail === "string") detail = errBody.detail;
    } catch {
      /* défaut */
    }
    const status =
      detail === "company_required" || detail === "company_mismatch"
        ? 422
        : detail.startsWith("account_")
          ? 403
          : upstream.status === 401
            ? 401
            : 502;
    return NextResponse.json({ error: detail }, { status });
  }

  const data = (await upstream.json()) as TokenResponse;
  const payload = decodeJwtPayload(data.access_token);
  const role = payload?.role ?? "";

  // RBAC back-office : seuls admin/manager/agent. Les clients/fournisseurs
  // utilisent le portail public (port 3001).
  if (!BACKOFFICE_ROLES.has(role)) {
    return NextResponse.json({ error: "use_portal" }, { status: 403 });
  }
  if (payload?.status && payload.status !== "active") {
    return NextResponse.json(
      { error: "account_not_active", status: payload.status },
      { status: 403 },
    );
  }

  // Succès → reset rate limit + cookies httpOnly (access + refresh)
  resetRateLimit(ip);

  await setSessionCookies(
    data.access_token,
    data.expires_in,
    data.refresh_token,
    data.refresh_expires_in,
  );

  return NextResponse.json({ success: true });
}
