import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DEMO_LOGIN    = process.env.DEMO_LOGIN    ?? "";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
const JWT_SECRET    = process.env.JWT_SECRET    ?? "";

// ─── Rate limiter (in-memory, Edge-compatible) ────────────────────────────────
// Max 5 tentatives par IP par 15 minutes

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

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now    = Math.floor(Date.now() / 1000);
  const body   = b64url(JSON.stringify({ ...payload, iat: now, exp: now + 8 * 3600 }));
  const sig    = b64url(createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!DEMO_LOGIN || !DEMO_PASSWORD || !JWT_SECRET) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // Validate Content-Type
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 415 });
  }

  // Rate limit check
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "too_many_requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfter ?? 60) },
      }
    );
  }

  let login: string, password: string;
  try {
    const body = (await req.json()) as { login?: unknown; password?: unknown };
    login    = typeof body.login    === "string" ? body.login    : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Validate input lengths
  if (login.length > 100) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  if (password.length > 200) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const loginOk = login.trim() === DEMO_LOGIN;
  const passOk  = password     === DEMO_PASSWORD;

  if (!loginOk || !passOk) {
    // Generic delay to slow down brute-force
    await new Promise(r => setTimeout(r, 400));
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // Reset rate limit on successful login
  resetRateLimit(ip);

  const token = signJwt({ sub: "demo-user", role: "admin", name: "Hicham Sadiki" });

  const cookieStore = await cookies();
  cookieStore.set("sgi-session", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   8 * 60 * 60,
    path:     "/",
  });

  return NextResponse.json({ success: true });
}
