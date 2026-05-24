"use client";

export async function apiLogin(login: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ login, password }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "error_creds");
  }
}

export async function apiLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
