import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { readCookie } from "./cookies";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE, baseCookieOptions } from "./session-cookie";

/**
 * CSRF protection.
 *
 * The threat: while you are signed in, a malicious page tricks your browser
 * into sending a request to us, and the browser helpfully attaches your
 * session cookie. The defence: every state-changing request must also carry a
 * secret token in a header that a malicious page cannot obtain (browsers stop
 * other sites reading our API's responses — see CORS in main.ts).
 *
 * Tokens are SIGNED rather than remembered: `nonce.expiry.signature`, where
 * the signature is an HMAC of the first two parts under JWT_SECRET. The
 * server can verify one without storing anything and — crucially — without
 * any cookie. The earlier design compared a header against a cookie, which
 * silently failed in every browser that blocks third-party cookies (most
 * phones), so people could not even sign in.
 *
 * The old cookie-comparison is still accepted so a page loaded before this
 * change keeps working until it refreshes.
 */

export const CSRF_COOKIE = "lycie_csrf";
export const CSRF_HEADER = "x-csrf-token";
const CSRF_LIFETIME_MS = 2 * 60 * 60 * 1000;

function signingKey(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be configured.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(`csrf:${payload}`).digest("hex");
}

export function createCsrfToken(now: number = Date.now()): string {
  const payload = `${randomBytes(16).toString("hex")}.${now + CSRF_LIFETIME_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Signature genuine and not expired? */
export function isValidSignedCsrfToken(token: string, now: number = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expiry, signature] = parts;

  const expected = Buffer.from(sign(`${nonce}.${expiry}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  return Number(expiry) > now;
}

/** Legacy cookie is still handed out so already-open pages keep working. */
export function setCsrfCookie(response: Response, token: string): void {
  response.cookie(CSRF_COOKIE, token, { ...baseCookieOptions(), httpOnly: false, maxAge: CSRF_LIFETIME_MS });
}

export function hasValidCsrfToken(request: Request): boolean {
  const header = request.headers[CSRF_HEADER];
  const headerToken = Array.isArray(header) ? header[0] : header;
  if (typeof headerToken !== "string" || headerToken.length === 0) return false;

  if (isValidSignedCsrfToken(headerToken)) return true;

  // Legacy: header must equal the CSRF cookie.
  const cookieToken = readCookie(request.headers.cookie, CSRF_COOKIE);
  if (!cookieToken || cookieToken.length !== headerToken.length) return false;
  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
}

const AUTH_FORM_PATH = /\/(login|login\/2fa|register|forgot-password|reset-password|verify-email|social\/[a-z]+)\/?$/;

/**
 * CSRF only matters when the browser would attach credentials on its own: a
 * login session cookie. A request with no session (a visitor sending the contact
 * form, liking a vehicle, chatting with Lycie) has nothing for another site to
 * hijack, so demanding the token there would only add failure modes. Sign-in,
 * registration and reset calls stay protected regardless.
 */
export function csrfCheckRequired(request: Request): boolean {
  const cookieHeader = request.headers.cookie;
  const hasSession =
    Boolean(readCookie(cookieHeader, ADMIN_SESSION_COOKIE)) || Boolean(readCookie(cookieHeader, CUSTOMER_SESSION_COOKIE));
  return hasSession || AUTH_FORM_PATH.test(request.path);
}
