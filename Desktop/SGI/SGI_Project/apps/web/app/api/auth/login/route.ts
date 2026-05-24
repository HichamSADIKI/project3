import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DEMO_LOGIN    = process.env.DEMO_LOGIN    ?? "";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
const JWT_SECRET    = process.env.JWT_SECRET    ?? "";

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

export async function POST(req: Request) {
  if (!DEMO_LOGIN || !DEMO_PASSWORD || !JWT_SECRET) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let login: string, password: string;
  try {
    const body = (await req.json()) as { login?: string; password?: string };
    login    = body.login    ?? "";
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const loginOk = login.trim() === DEMO_LOGIN;
  const passOk  = password     === DEMO_PASSWORD;

  if (!loginOk || !passOk) {
    // Generic delay to slow down brute-force
    await new Promise(r => setTimeout(r, 400));
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

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
