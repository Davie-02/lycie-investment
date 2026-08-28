import type { CookieOptions, Response } from "express";

export const ADMIN_SESSION_COOKIE = "lycie_admin_session";
export const CUSTOMER_SESSION_COOKIE = "lycie_customer_session";

const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function sessionCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  };
}

export function setSessionCookie(response: Response, name: string, token: string): void {
  response.cookie(name, token, sessionCookieOptions());
}

export function clearSessionCookie(response: Response, name: string): void {
  response.clearCookie(name, sessionCookieOptions());
}