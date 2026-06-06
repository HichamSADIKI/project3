"use client";

function sanitize(s: string): string {
  return s.trim().slice(0, 200);
}

export async function apiLogin(login: string, password: string): Promise<void> {
  const safeLogin    = sanitize(login).slice(0, 100); // login max 100 chars
  const safePassword = password.slice(0, 200);        // pas de trim sur le password

  const res = await fetch("/api/auth/login", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ login: safeLogin, password: safePassword }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "error_creds");
  }
}

export async function apiLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
