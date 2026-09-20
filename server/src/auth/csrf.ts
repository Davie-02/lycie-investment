import { randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { readCookie } from "./cookies";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "./session-cookie";

export const CSRF_COOKIE = "lycie_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function createCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function setCsrfCookie(response: Response, token: string): void {
  response.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 2 * 60 * 60 * 1000,
    path: "/",
  });
}

export function hasValidCsrfToken(request: Request): boolean {
  const cookieToken = readCookie(request.headers.cookie, CSRF_COOKIE);
  const header = request.headers[CSRF_HEADER];
  const headerToken = Array.isArray(header) ? header[0] : header;

  if (!cookieToken || typeof headerToken !== "string") return false;
  if (cookieToken.length !== headerToken.length) return false;

  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
}

const AUTH_FORM_PATH = /\/(login|register|forgot-password|reset-password)\/?$/;

/**
 * CSRF only matters when the browser would attach credentials on its own: a
 * login session cookie. A request with no session (a visitor sending the contact
 * form, liking a vehicle, chatting with Lycie) has nothing for another site to
 * hijack, so demanding the token there only breaks browsers that block the
 * cross-site CSRF cookie — which is most phones, since the site and API live on
 * different domains. Login/registration/reset calls stay protected regardless.
 */
export function csrfCheckRequired(request: Request): boolean {
  const cookieHeader = request.headers.cookie;
  const hasSession =
    Boolean(readCookie(cookieHeader, ADMIN_SESSION_COOKIE)) || Boolean(readCookie(cookieHeader, CUSTOMER_SESSION_COOKIE));
  return hasSession || AUTH_FORM_PATH.test(request.path);
}
