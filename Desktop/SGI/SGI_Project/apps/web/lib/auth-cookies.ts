/**
 * Cookies de session du back-office (server-side uniquement).
 *
 * Deux cookies httpOnly, posés/effacés de façon cohérente :
 * - `sgi-session` : access JWT court (≈ 1 h). Envoyé sur tout le site (`path:/`)
 *   car chaque appel API protégé en a besoin.
 * - `sgi-refresh` : refresh token long (30 j), **scopé à `/api/auth`** → il n'est
 *   transmis qu'aux endpoints d'auth (`/api/auth/refresh` et `/api/auth/logout`),
 *   jamais sur les pages ni les autres routes API. Réduit la surface d'exposition.
 *
 * httpOnly (pas d'accès JS → anti-XSS) + SameSite=Strict (anti-CSRF) +
 * Secure en production.
 */
import { cookies } from "next/headers";

export const SESSION_COOKIE = "sgi-session";
export const REFRESH_COOKIE = "sgi-refresh";
export const REFRESH_PATH = "/api/auth";

const secure = process.env.NODE_ENV === "production";

/** Pose (ou remplace) les deux cookies de session après login / refresh. */
export async function setSessionCookies(
  accessToken: string,
  accessExpiresIn: number,
  refreshToken: string,
  refreshExpiresIn: number,
): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: accessExpiresIn,
    path: "/",
  });
  jar.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: refreshExpiresIn,
    path: REFRESH_PATH,
  });
}

/** Efface les deux cookies (logout, refresh échoué, session invalide). */
export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  jar.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: 0,
    path: REFRESH_PATH,
  });
}

/** Lit le refresh token (cookie httpOnly) — null si absent. */
export async function getRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}
