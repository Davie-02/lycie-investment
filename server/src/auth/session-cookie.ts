import type { CookieOptions, Response } from "express";

export const ADMIN_SESSION_COOKIE = "lycie_admin_session";
export const CUSTOMER_SESSION_COOKIE = "lycie_customer_session";

// Mirrors the JWT's own lifetime (see auth.module.ts's signOptions.expiresIn)
// so the cookie never outlives the token inside it. If these drift apart —
// e.g. JWT_EXPIRES_IN gets shortened but this stays fixed — the browser
// keeps sending a cookie that *looks* valid long after the server has
// already rejected the token, surfacing as a confusing "session expired"
// mid-task instead of a predictable logout.
const SESSION_MAX_AGE_MS = parseDurationMs(process.env.JWT_EXPIRES_IN || "2h");

function parseDurationMs(duration: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(duration.trim());
  if (!match) return 2 * 60 * 60 * 1000;

  const unitMs: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * unitMs[match[2].toLowerCase()];
}

function baseCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
}

export function setSessionCookie(response: Response, name: string, token: string): void {
  response.cookie(name, token, { ...baseCookieOptions(), maxAge: SESSION_MAX_AGE_MS });
}

export function clearSessionCookie(response: Response, name: string): void {
  // clearCookie deprecated accepting maxAge — it always expires the cookie
  // immediately regardless, so only the matching attributes (path, sameSite,
  // secure) are needed for the browser to find and remove the right cookie.
  response.clearCookie(name, baseCookieOptions());
}